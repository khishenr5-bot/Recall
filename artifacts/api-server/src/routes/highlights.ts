import { Router } from "express";
import { db, highlightsTable, savedArticlesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { CreateHighlightBody, DeleteHighlightParams } from "@workspace/api-zod";

const router = Router();

router.get("/highlights", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;

  const highlights = await db.select({
    id: highlightsTable.id,
    userId: highlightsTable.userId,
    articleId: highlightsTable.articleId,
    bulletText: highlightsTable.bulletText,
    note: highlightsTable.note,
    articleTitle: savedArticlesTable.title,
    createdAt: highlightsTable.createdAt,
  })
    .from(highlightsTable)
    .leftJoin(savedArticlesTable, eq(highlightsTable.articleId, savedArticlesTable.id))
    .where(eq(highlightsTable.userId, user.id))
    .orderBy(highlightsTable.createdAt);

  res.json(highlights.map(h => ({
    id: h.id,
    userId: h.userId,
    articleId: h.articleId,
    bulletText: h.bulletText,
    note: h.note,
    articleTitle: h.articleTitle,
    createdAt: h.createdAt.toISOString(),
  })));
});

router.post("/highlights", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const parsed = CreateHighlightBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Verify article belongs to user
  const [article] = await db.select().from(savedArticlesTable)
    .where(and(eq(savedArticlesTable.id, parsed.data.articleId), eq(savedArticlesTable.userId, user.id)));

  if (!article) {
    res.status(404).json({ error: "Article not found" });
    return;
  }

  const [highlight] = await db.insert(highlightsTable).values({
    userId: user.id,
    articleId: parsed.data.articleId,
    bulletText: parsed.data.bulletText,
    note: parsed.data.note ?? null,
  }).returning();

  if (!highlight) {
    res.status(500).json({ error: "Failed to save highlight" });
    return;
  }

  res.status(201).json({
    id: highlight.id,
    userId: highlight.userId,
    articleId: highlight.articleId,
    bulletText: highlight.bulletText,
    note: highlight.note,
    articleTitle: article.title,
    createdAt: highlight.createdAt.toISOString(),
  });
});

router.delete("/highlights/:id", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteHighlightParams.safeParse({ id: parseInt(rawId ?? "0", 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db.delete(highlightsTable)
    .where(and(eq(highlightsTable.id, params.data.id), eq(highlightsTable.userId, user.id)))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Highlight not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
