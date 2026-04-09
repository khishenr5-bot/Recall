import { Router } from "express";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { db, articleNotesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

// GET /notes/:articleId
router.get("/notes/:articleId", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const articleId = Number(req.params.articleId);
  const notes = await db.select().from(articleNotesTable)
    .where(and(eq(articleNotesTable.userId, user.id), eq(articleNotesTable.articleId, articleId)));
  res.json({ note: notes[0] || null });
});

// GET /notes — all notes for user (for Notes tab on Highlights page)
router.get("/notes", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const notes = await db.select().from(articleNotesTable).where(eq(articleNotesTable.userId, user.id));
  res.json({ notes });
});

// POST /notes
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

// PUT /notes/:id
router.put("/notes/:id", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const noteId = Number(req.params.id);
  const noteText = String(req.body?.noteText ?? "").trim();
  if (!noteText) { res.status(400).json({ error: "noteText required" }); return; }

  const [updated] = await db.update(articleNotesTable).set({ noteText })
    .where(and(eq(articleNotesTable.id, noteId), eq(articleNotesTable.userId, user.id)))
    .returning();
  if (!updated) { res.status(404).json({ error: "Note not found" }); return; }
  res.json({ note: updated });
});

// DELETE /notes/:id
router.delete("/notes/:id", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const noteId = Number(req.params.id);
  await db.delete(articleNotesTable).where(and(eq(articleNotesTable.id, noteId), eq(articleNotesTable.userId, user.id)));
  res.json({ success: true });
});

export default router;
