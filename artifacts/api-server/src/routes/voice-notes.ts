import { Router } from "express";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { db, voiceNotesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";

const router = Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function parseTags(transcript: string): { cleanedTranscript: string; tags: string[] } {
  const tags = new Set<string>();
  let cleaned = transcript;

  // "tag: X" or "tags: X"
  cleaned = cleaned.replace(/\btags?:\s*([^\s,\.]+)/gi, (_, tag) => {
    tags.add(tag.toLowerCase().replace(/[^a-z0-9-]/g, ""));
    return "";
  });

  // "hashtag X"
  cleaned = cleaned.replace(/\bhashtag\s+([^\s,\.]+)/gi, (_, tag) => {
    tags.add(tag.toLowerCase().replace(/[^a-z0-9-]/g, ""));
    return "";
  });

  // "#X" spoken as "#word"
  cleaned = cleaned.replace(/#([a-zA-Z][a-zA-Z0-9-]*)/g, (_, tag) => {
    tags.add(tag.toLowerCase());
    return "";
  });

  // Collapse extra spaces
  cleaned = cleaned.replace(/\s{2,}/g, " ").trim();

  return { cleanedTranscript: cleaned, tags: Array.from(tags).filter(Boolean) };
}

// GET all voice notes
router.get("/voice-notes", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  try {
    const notes = await db
      .select()
      .from(voiceNotesTable)
      .where(eq(voiceNotesTable.userId, user.id))
      .orderBy(desc(voiceNotesTable.createdAt));
    res.json({ notes });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch voice notes" });
  }
});

// POST create voice note
router.post("/voice-notes", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const { transcript, source_url, source_title, page_context } = req.body;

  if (!transcript?.trim()) {
    res.status(400).json({ error: "transcript is required" });
    return;
  }

  const { cleanedTranscript, tags } = parseTags(transcript);

  let summary = "";
  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 120,
      messages: [{
        role: "user",
        content: `Summarize this voice note in one clear, concise sentence (max 120 chars):\n\n"${cleanedTranscript}"`,
      }],
    });
    summary = (msg.content[0] as any).text?.trim() ?? "";
  } catch {
    summary = cleanedTranscript.slice(0, 120);
  }

  try {
    const [note] = await db
      .insert(voiceNotesTable)
      .values({
        userId: user.id,
        transcript: cleanedTranscript,
        summary,
        tags,
        sourceUrl: source_url || null,
        sourceTitle: source_title || null,
        pageContext: page_context || null,
      })
      .returning();

    res.json({ note });
  } catch (err) {
    res.status(500).json({ error: "Failed to save voice note" });
  }
});

// DELETE voice note
router.delete("/voice-notes/:id", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const id = Number(req.params.id);

  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [note] = await db
    .select({ id: voiceNotesTable.id, userId: voiceNotesTable.userId })
    .from(voiceNotesTable)
    .where(eq(voiceNotesTable.id, id));

  if (!note || note.userId !== user.id) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  await db.delete(voiceNotesTable).where(eq(voiceNotesTable.id, id));
  res.json({ success: true });
});

export default router;
