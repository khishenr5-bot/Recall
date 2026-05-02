import { Router } from "express";
import multer from "multer";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { db, importedMemoriesTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import AdmZip from "adm-zip";
import { parse as csvParse } from "csv-parse/sync";
import { XMLParser } from "fast-xml-parser";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type Entry = { title?: string; content: string; originalDate?: Date };

// ─── Parsers ─────────────────────────────────────────────────────────────────

function parseChatGPT(buf: Buffer): Entry[] {
  try {
    const json = JSON.parse(buf.toString("utf-8"));
    const items: any[] = Array.isArray(json) ? json : (json.memories ?? json.memory ?? []);
    return items
      .filter((m: any) => typeof m?.memory === "string" && m.memory.trim())
      .map((m: any) => ({
        content: m.memory.trim(),
        originalDate: m.created_at ? new Date(m.created_at) : undefined,
      }));
  } catch {
    return [];
  }
}

function parseMarkdownZip(buf: Buffer): Entry[] {
  const zip = new AdmZip(buf);
  const entries: Entry[] = [];
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    if (!entry.entryName.match(/\.(md|markdown|txt)$/i)) continue;
    const text = zip.readAsText(entry);
    if (!text?.trim()) continue;
    const lines = text.split("\n");
    const firstLine = lines[0].replace(/^#+\s*/, "").trim();
    const title = firstLine || entry.entryName.replace(/.*\//, "").replace(/\.(md|markdown|txt)$/, "");
    const content = text.trim();
    entries.push({ title, content });
  }
  return entries;
}

function parseReadwiseCSV(buf: Buffer): Entry[] {
  try {
    const records: any[] = csvParse(buf.toString("utf-8"), {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
    return records
      .filter((r: any) => (r.Highlight || r.highlight || r.text)?.trim())
      .map((r: any) => {
        const highlight = r.Highlight || r.highlight || r.text || "";
        const note = r.Note || r.note || "";
        const title = r.Title || r.title || r.Book || r.book || "";
        const author = r.Author || r.author || "";
        const dateStr = r.Date || r.date || r.highlighted_at || "";
        return {
          title: title || undefined,
          content: [
            title && author ? `${title} — ${author}` : title || author,
            highlight,
            note ? `Note: ${note}` : "",
          ].filter(Boolean).join("\n\n"),
          originalDate: dateStr ? new Date(dateStr) : undefined,
        };
      });
  } catch {
    return [];
  }
}

function parseEvernoteENEX(buf: Buffer): Entry[] {
  try {
    const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: true, parseAttributeValue: true });
    const result = parser.parse(buf.toString("utf-8"));
    const enExport = result["en-export"] ?? result;
    const notes: any[] = Array.isArray(enExport.note) ? enExport.note : enExport.note ? [enExport.note] : [];
    return notes.map((n: any) => {
      const title = String(n.title ?? "").trim();
      const rawContent = String(n.content ?? "").trim();
      // Strip ENML tags
      const text = rawContent.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      const dateStr = n.created ?? n.updated ?? "";
      return {
        title: title || undefined,
        content: title ? `${title}\n\n${text}` : text,
        originalDate: dateStr ? new Date(String(dateStr)) : undefined,
      };
    }).filter((e: Entry) => e.content.trim().length > 10);
  } catch {
    return [];
  }
}

function parsePlainText(text: string): Entry[] {
  return text
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(p => p.length > 5)
    .map(p => ({ content: p }));
}

function parseClaudeConversation(text: string): Entry[] {
  // Split on Human: / Assistant: turn markers (case-insensitive)
  const parts: { role: string; text: string }[] = [];
  const matches: { role: string; index: number }[] = [];
  let m: RegExpExecArray | null;
  const re = /(?:^|\n)(Human|Assistant)\s*:/gi;
  while ((m = re.exec(text)) !== null) {
    matches.push({ role: m[1].toLowerCase(), index: m.index + m[0].indexOf(m[1]) });
  }

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index + matches[i].role.length + 1; // skip "Role:"
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const content = text.slice(start, end).replace(/^[\s:]+/, "").trim();
    if (content) parts.push({ role: matches[i].role, text: content });
  }

  if (parts.length === 0) {
    // Fallback: treat whole text as a single assistant response
    return [{ title: "Claude Conversation", content: text.trim() }];
  }

  // Extract only assistant turns, group consecutive ones and pair with preceding human turn as title
  const entries: Entry[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].role !== "assistant") continue;
    const assistantText = parts[i].text;
    if (assistantText.length < 20) continue; // skip very short replies

    // Use preceding human message as title hint
    const humanTurn = i > 0 && parts[i - 1].role === "human" ? parts[i - 1].text : null;
    const title = humanTurn ? humanTurn.slice(0, 80).replace(/\s+/g, " ") : undefined;

    entries.push({ title, content: assistantText });
  }

  return entries.filter(e => e.content.length > 30);
}

// ─── AI Summarize + Tag per entry ────────────────────────────────────────────

async function summarizeEntry(content: string, promptOverride?: string): Promise<{ summary: string; tags: string[] }> {
  try {
    const prompt = promptOverride ??
      `Given this memory/note, write ONE concise summary sentence (max 120 chars) and extract 1–4 lowercase topic tags. Reply as JSON only: {"summary":"...","tags":["tag1","tag2"]}\n\nNote:\n${content.slice(0, 600)}`;
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 150,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = (msg.content[0] as any).text?.trim() ?? "{}";
    const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      summary: String(parsed.summary ?? "").slice(0, 150),
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5).map((t: any) => String(t).toLowerCase()) : [],
    };
  } catch {
    return { summary: content.slice(0, 120), tags: [] };
  }
}

async function summarizeClaudeTurn(content: string): Promise<{ summary: string; tags: string[] }> {
  const prompt = `This is a response from a Claude AI conversation. Extract the key insight, decision, or knowledge from it in ONE concise sentence (max 120 chars). Also extract 1–4 lowercase topic tags. Always include the tag "claude-conversation". Reply as JSON only: {"summary":"...","tags":["claude-conversation","tag2"]}\n\nAssistant response:\n${content.slice(0, 800)}`;
  const result = await summarizeEntry(content, prompt);
  // Ensure claude-conversation tag is always present
  if (!result.tags.includes("claude-conversation")) {
    result.tags.unshift("claude-conversation");
  }
  return result;
}

// ─── Import route ─────────────────────────────────────────────────────────────

router.post("/import/:source", requireAuth, upload.single("file"), async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const source = req.params.source as string;

  const validSources = ["chatgpt", "notion", "obsidian", "readwise", "evernote", "text", "claude"];
  if (!validSources.includes(source)) {
    res.status(400).json({ error: "Unknown source" });
    return;
  }

  // Setup SSE for streaming progress
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  let entries: Entry[] = [];

  try {
    if (source === "text") {
      const text = String(req.body?.text ?? "").trim();
      if (!text) { send({ error: "No text provided" }); res.end(); return; }
      entries = parsePlainText(text);
    } else if (source === "claude") {
      const text = String(req.body?.text ?? "").trim();
      if (!text) { send({ error: "No conversation text provided" }); res.end(); return; }
      entries = parseClaudeConversation(text);
    } else {
      const file = req.file;
      if (!file) { send({ error: "No file uploaded" }); res.end(); return; }

      if (source === "chatgpt") {
        entries = parseChatGPT(file.buffer);
      } else if (source === "notion" || source === "obsidian") {
        entries = parseMarkdownZip(file.buffer);
      } else if (source === "readwise") {
        entries = parseReadwiseCSV(file.buffer);
      } else if (source === "evernote") {
        entries = parseEvernoteENEX(file.buffer);
      }
    }
  } catch (err: any) {
    send({ error: "Failed to parse file: " + (err?.message ?? "Unknown error") });
    res.end();
    return;
  }

  const total = entries.length;
  if (total === 0) {
    send({ error: "No entries found in the file. Check the format." });
    res.end();
    return;
  }

  send({ total, processed: 0, failed: 0, stage: "parsing" });

  let processed = 0;
  let failed = 0;
  const BATCH = 5;

  for (let i = 0; i < entries.length; i += BATCH) {
    const batch = entries.slice(i, i + BATCH);

    await Promise.allSettled(batch.map(async (entry) => {
      try {
        const { summary, tags } = source === "claude"
          ? await summarizeClaudeTurn(entry.content)
          : await summarizeEntry(entry.content);
        await db.insert(importedMemoriesTable).values({
          userId: user.id,
          source,
          title: entry.title ?? null,
          content: entry.content,
          summary,
          tags,
          originalDate: entry.originalDate ?? null,
        });
        processed++;
      } catch {
        failed++;
      }
    }));

    send({ total, processed, failed, stage: "processing" });
  }

  send({ total, processed, failed, stage: "done" });
  res.end();
});

// GET all memories (for library)
router.get("/memories", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const source = req.query.source as string | undefined;
  const limit = Math.min(Number(req.query.limit ?? 50), 100);
  const offset = Number(req.query.offset ?? 0);

  const { importedMemoriesTable } = await import("@workspace/db");
  const { desc, eq, and } = await import("drizzle-orm");

  const where = source
    ? and(eq(importedMemoriesTable.userId, user.id), eq(importedMemoriesTable.source, source))
    : eq(importedMemoriesTable.userId, user.id);

  const memories = await db
    .select()
    .from(importedMemoriesTable)
    .where(where)
    .orderBy(desc(importedMemoriesTable.createdAt))
    .limit(limit)
    .offset(offset);

  res.json({ memories });
});

// GET memory stats
router.get("/memories/stats", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;

  const rows = await db
    .select({ source: importedMemoriesTable.source, cnt: count() })
    .from(importedMemoriesTable)
    .where(eq(importedMemoriesTable.userId, user.id))
    .groupBy(importedMemoriesTable.source);

  const total = rows.reduce((s, r) => s + Number(r.cnt), 0);

  // Oldest memory
  const oldest = await db
    .select({ originalDate: importedMemoriesTable.originalDate, createdAt: importedMemoriesTable.createdAt })
    .from(importedMemoriesTable)
    .where(eq(importedMemoriesTable.userId, user.id))
    .orderBy(importedMemoriesTable.originalDate)
    .limit(1);

  res.json({
    total,
    bySource: rows.map(r => ({ source: r.source, count: Number(r.cnt) })),
    oldestDate: oldest[0]?.originalDate?.toISOString() ?? oldest[0]?.createdAt?.toISOString() ?? null,
  });
});

// DELETE all memories
router.delete("/memories", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  await db.delete(importedMemoriesTable).where(eq(importedMemoriesTable.userId, user.id));
  res.json({ success: true });
});

// DELETE single memory
router.delete("/memories/:id", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db
    .delete(importedMemoriesTable)
    .where(eq(importedMemoriesTable.id, id));
  res.json({ success: true });
});

export default router;
