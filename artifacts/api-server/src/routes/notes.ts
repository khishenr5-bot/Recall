import { Router } from "express";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { db, articleNotesTable, standaloneNotesTable, savedArticlesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";

const router = Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Article-attached notes ───────────────────────────────────────────────────

router.get("/notes/article/:articleId", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const articleId = Number(req.params.articleId);
  const notes = await db.select().from(articleNotesTable)
    .where(and(eq(articleNotesTable.userId, user.id), eq(articleNotesTable.articleId, articleId)));
  res.json({ note: notes[0] || null });
});

router.get("/notes/article-all", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const notes = await db.select().from(articleNotesTable).where(eq(articleNotesTable.userId, user.id));
  res.json({ notes });
});

router.post("/notes/article", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const articleId = Number(req.body?.articleId);
  const noteText = String(req.body?.noteText ?? "").trim();
  if (!articleId || !noteText) { res.status(400).json({ error: "articleId and noteText required" }); return; }

  const [existing] = await db.select().from(articleNotesTable)
    .where(and(eq(articleNotesTable.userId, user.id), eq(articleNotesTable.articleId, articleId)));

  if (existing) {
    const [updated] = await db.update(articleNotesTable).set({ noteText })
      .where(eq(articleNotesTable.id, existing.id)).returning();
    res.json({ note: updated });
    return;
  }
  const [note] = await db.insert(articleNotesTable).values({ userId: user.id, articleId, noteText }).returning();
  res.status(201).json({ note });
});

// Keep backward-compat routes for the highlights page
router.get("/notes", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const notes = await db.select().from(articleNotesTable).where(eq(articleNotesTable.userId, user.id));
  res.json({ notes });
});

router.post("/notes", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const articleId = Number(req.body?.articleId);
  const noteText = String(req.body?.noteText ?? "").trim();
  if (!articleId || !noteText) { res.status(400).json({ error: "articleId and noteText required" }); return; }

  const [existing] = await db.select().from(articleNotesTable)
    .where(and(eq(articleNotesTable.userId, user.id), eq(articleNotesTable.articleId, articleId)));
  if (existing) {
    const [updated] = await db.update(articleNotesTable).set({ noteText })
      .where(eq(articleNotesTable.id, existing.id)).returning();
    res.json({ note: updated });
    return;
  }
  const [note] = await db.insert(articleNotesTable).values({ userId: user.id, articleId, noteText }).returning();
  res.status(201).json({ note });
});

router.put("/notes/:id", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const noteId = Number(req.params.id);
  const noteText = String(req.body?.noteText ?? "").trim();
  if (!noteText) { res.status(400).json({ error: "noteText required" }); return; }
  const [updated] = await db.update(articleNotesTable).set({ noteText })
    .where(and(eq(articleNotesTable.id, noteId), eq(articleNotesTable.userId, user.id))).returning();
  if (!updated) { res.status(404).json({ error: "Note not found" }); return; }
  res.json({ note: updated });
});

router.delete("/notes/:id", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const noteId = Number(req.params.id);
  await db.delete(articleNotesTable).where(and(eq(articleNotesTable.id, noteId), eq(articleNotesTable.userId, user.id)));
  res.json({ success: true });
});

// ─── Standalone notes (Personal Notes with backlinks) ─────────────────────────

// GET all standalone notes
router.get("/standalone-notes", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const notes = await db.select().from(standaloneNotesTable)
    .where(eq(standaloneNotesTable.userId, user.id));
  res.json({ notes });
});

// GET single standalone note
router.get("/standalone-notes/:id", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const noteId = Number(req.params.id);
  const [note] = await db.select().from(standaloneNotesTable)
    .where(and(eq(standaloneNotesTable.id, noteId), eq(standaloneNotesTable.userId, user.id)));
  if (!note) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ note });
});

// POST create standalone note
router.post("/standalone-notes", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const title = String(req.body?.title ?? "Untitled Note").trim();
  const content = String(req.body?.content ?? "").trim();
  const linkedArticleIds = Array.isArray(req.body?.linkedArticleIds) ? req.body.linkedArticleIds : [];
  const [note] = await db.insert(standaloneNotesTable)
    .values({ userId: user.id, title, content, linkedArticleIds })
    .returning();
  res.status(201).json({ note });
});

// PUT update standalone note
router.put("/standalone-notes/:id", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const noteId = Number(req.params.id);
  const updates: Record<string, unknown> = {};
  if (req.body?.title !== undefined) updates.title = String(req.body.title).trim() || "Untitled Note";
  if (req.body?.content !== undefined) updates.content = String(req.body.content);
  if (Array.isArray(req.body?.linkedArticleIds)) updates.linkedArticleIds = req.body.linkedArticleIds;
  const [updated] = await db.update(standaloneNotesTable).set(updates)
    .where(and(eq(standaloneNotesTable.id, noteId), eq(standaloneNotesTable.userId, user.id)))
    .returning();
  if (!updated) { res.status(404).json({ error: "Note not found" }); return; }
  res.json({ note: updated });
});

// DELETE standalone note
router.delete("/standalone-notes/:id", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const noteId = Number(req.params.id);
  await db.delete(standaloneNotesTable)
    .where(and(eq(standaloneNotesTable.id, noteId), eq(standaloneNotesTable.userId, user.id)));
  res.json({ success: true });
});

// POST suggest article links for a note using AI
router.post("/standalone-notes/:id/suggest-links", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const { content } = req.body;
  const articles = await db.select({ id: savedArticlesTable.id, title: savedArticlesTable.title })
    .from(savedArticlesTable).where(eq(savedArticlesTable.userId, user.id)).limit(30);
  if (!articles.length) { res.json({ suggestions: [] }); return; }

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [{
        role: "user",
        content: `Given this note: "${String(content ?? "").slice(0, 600)}"
Which of these saved articles are most relevant? Return only the IDs of the top 3.
Articles: ${articles.map(a => `ID:${a.id} "${a.title}"`).join(", ")}
Return JSON: {"ids":[1,2,3]}`
      }]
    });
    const text = message.content[0].type === "text" ? message.content[0].text : "{}";
    const match = text.match(/\{[\s\S]*\}/);
    const { ids } = match ? JSON.parse(match[0]) : { ids: [] };
    const suggestions = articles.filter(a => ids.includes(a.id));
    res.json({ suggestions });
  } catch {
    res.json({ suggestions: [] });
  }
});

// GET notes that link to a specific article
router.get("/standalone-notes/for-article/:articleId", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const articleId = Number(req.params.articleId);
  const allNotes = await db.select().from(standaloneNotesTable)
    .where(eq(standaloneNotesTable.userId, user.id));
  const linked = allNotes.filter(n => (n.linkedArticleIds as number[]).includes(articleId));
  res.json({ notes: linked });
});

export default router;
