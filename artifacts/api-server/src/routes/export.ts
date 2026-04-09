import { Router } from "express";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { db, savedArticlesTable, highlightsTable, collectionsTable, articleNotesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import archiver from "archiver";

const router = Router();

router.get("/export/json", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;

  const [articles, highlights, collections] = await Promise.all([
    db.select().from(savedArticlesTable).where(eq(savedArticlesTable.userId, user.id)),
    db.select().from(highlightsTable).where(eq(highlightsTable.userId, user.id)),
    db.select().from(collectionsTable).where(eq(collectionsTable.userId, user.id)),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    user: { email: user.email, username: user.username, plan: user.plan },
    articles: articles.map(a => ({
      id: a.id, url: a.url, title: a.title,
      verdict: a.verdict, bullets: a.bullets,
      articleText: a.articleText, recallScore: a.recallScore,
      credibilityScore: a.credibilityScore, credibilityVerdict: a.credibilityVerdict,
      language: a.language, sourceType: a.sourceType,
      collectionId: a.collectionId, createdAt: a.createdAt,
    })),
    highlights: highlights.map(h => ({
      id: h.id, bulletText: h.bulletText, note: h.note,
      articleId: h.articleId, createdAt: h.createdAt,
    })),
    collections: collections.map(c => ({
      id: c.id, name: c.name, color: c.color, createdAt: c.createdAt,
    })),
  };

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="recall-export-${Date.now()}.json"`);
  res.json(payload);
});

router.get("/export/markdown", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const articles = await db.select().from(savedArticlesTable).where(eq(savedArticlesTable.userId, user.id));

  // Build a single combined markdown file
  const lines: string[] = [
    `# Recall.ai Export — ${user.email}`,
    `> Exported on ${new Date().toLocaleDateString()}`,
    "",
  ];

  for (const a of articles) {
    const safeTitle = a.title.replace(/[^\w\s-]/g, "").trim() || "Untitled";
    lines.push(`## ${safeTitle}`);
    if (a.url) lines.push(`**Source:** ${a.url}`);
    lines.push(`**Recall Score:** ${a.recallScore}/10 | **Trust Score:** ${a.credibilityScore}/10`);
    lines.push(`**Date:** ${new Date(a.createdAt).toLocaleDateString()}`);
    lines.push("");
    if (a.verdict) { lines.push(`### Verdict`); lines.push(a.verdict); lines.push(""); }
    if (Array.isArray(a.bullets) && a.bullets.length > 0) {
      lines.push("### Key Takeaways");
      (a.bullets as string[]).forEach((b, i) => lines.push(`${i + 1}. ${b}`));
      lines.push("");
    }
    lines.push("---");
    lines.push("");
  }

  const content = lines.join("\n");
  res.setHeader("Content-Type", "text/markdown");
  res.setHeader("Content-Disposition", `attachment; filename="recall-library-${Date.now()}.md"`);
  res.send(content);
});

router.get("/export/csv", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const articles = await db.select().from(savedArticlesTable).where(eq(savedArticlesTable.userId, user.id));

  const escape = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;

  const headers = ["id", "title", "url", "verdict", "recall_score", "trust_score", "language", "source_type", "created_at"];
  const rows = articles.map(a => [
    a.id, escape(a.title), escape(a.url ?? ""), escape(a.verdict ?? ""),
    a.recallScore, a.credibilityScore, a.language ?? "", a.sourceType ?? "",
    new Date(a.createdAt).toISOString(),
  ].join(","));

  const csv = [headers.join(","), ...rows].join("\n");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="recall-articles-${Date.now()}.csv"`);
  res.send(csv);
});

// GET /export/markdown-zip — ZIP archive with one file per article
router.get("/export/markdown-zip", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const [articles, highlights, allNotes] = await Promise.all([
    db.select().from(savedArticlesTable).where(eq(savedArticlesTable.userId, user.id)),
    db.select().from(highlightsTable).where(eq(highlightsTable.userId, user.id)),
    db.select().from(articleNotesTable).where(eq(articleNotesTable.userId, user.id)),
  ]);

  const notesByArticle = new Map<number, string>();
  for (const n of allNotes) notesByArticle.set(n.articleId, n.noteText);

  const hlByArticle = new Map<number, typeof highlights>();
  for (const h of highlights) {
    if (!hlByArticle.has(h.articleId)) hlByArticle.set(h.articleId, []);
    hlByArticle.get(h.articleId)!.push(h);
  }

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="recall-library-${Date.now()}.zip"`);

  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.pipe(res);

  for (const a of articles) {
    const safeTitle = a.title.replace(/[^a-z0-9\s-]/gi, "").trim().slice(0, 60) || "Untitled";
    const lines: string[] = [
      `# ${a.title}`,
      "",
      `**Source:** ${a.url || "Uploaded file"}`,
      `**Saved:** ${new Date(a.createdAt).toLocaleDateString()}`,
      `**Recall Score:** ${a.recallScore}/10  |  **Trust Score:** ${a.credibilityScore}/10`,
      "",
      "## Verdict",
      a.verdict || "",
      "",
      "## Key Takeaways",
      ...(a.bullets as string[] ?? []).map((b, i) => `- [ ] ${b}`),
      "",
    ];

    const note = notesByArticle.get(a.id);
    if (note) { lines.push("## My Notes", note, ""); }

    const hl = hlByArticle.get(a.id);
    if (hl && hl.length > 0) {
      lines.push("## Highlights");
      hl.forEach(h => lines.push(`- "${h.bulletText}"`));
      lines.push("");
    }

    archive.append(lines.join("\n"), { name: `${safeTitle}.md` });
  }

  await archive.finalize();
});

// POST /import/json — restore from a Recall JSON export
router.post("/import/json", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const payload = req.body;
  if (!payload?.articles || !Array.isArray(payload.articles)) {
    res.status(400).json({ error: "Invalid export file. Expected { articles: [...] }" }); return;
  }

  let imported = 0;
  const errors: string[] = [];

  for (const a of payload.articles.slice(0, 500)) {
    try {
      await db.insert(savedArticlesTable).values({
        userId: user.id,
        url: a.url ?? null,
        title: String(a.title ?? "Untitled").slice(0, 500),
        verdict: a.verdict ?? null,
        bullets: Array.isArray(a.bullets) ? a.bullets : [],
        articleText: a.articleText ? String(a.articleText).slice(0, 20000) : null,
        recallScore: Number(a.recallScore) || 5,
        credibilityScore: Number(a.credibilityScore) || 5,
        credibilityVerdict: a.credibilityVerdict ?? null,
        language: a.language ?? "en",
        sourceType: a.sourceType ?? "url",
      }).onConflictDoNothing();
      imported++;
    } catch (e: any) {
      errors.push(String(e?.message ?? e).slice(0, 100));
    }
  }

  res.json({ imported, errors: errors.slice(0, 5), total: payload.articles.length });
});

export default router;
