import { Router } from "express";
import { db, savedArticlesTable, usersTable, collectionsTable } from "@workspace/db";
import { eq, and, desc, asc, count, ilike, or, sql, avg } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { v4 as uuidv4 } from "uuid";
import {
  GetSavedArticlesQueryParams,
  SaveArticleBody,
  GetSavedArticleParams,
  DeleteSavedArticleParams,
  UpdateArticleCollectionParams,
  UpdateArticleCollectionBody,
  ShareArticleParams,
  GetSharedArticleParams,
  CompleteReviewParams,
  CompleteReviewBody,
} from "@workspace/api-zod";

const router = Router();

function formatArticle(a: typeof savedArticlesTable.$inferSelect) {
  return {
    id: a.id,
    userId: a.userId,
    url: a.url,
    title: a.title,
    verdict: a.verdict,
    bullets: a.bullets as string[],
    articleText: a.articleText,
    language: a.language,
    recallScore: a.recallScore,
    credibilityScore: a.credibilityScore,
    credibilityVerdict: a.credibilityVerdict,
    collectionId: a.collectionId,
    shareToken: a.shareToken,
    isPublic: a.isPublic,
    lastReviewedAt: a.lastReviewedAt?.toISOString() ?? null,
    reviewCount: a.reviewCount,
    sourceType: a.sourceType,
    status: (a as any).status ?? "unread",
    readingProgress: (a as any).readingProgress ?? 0,
    isRss: (a as any).isRss ?? false,
    rssFeedId: (a as any).rssFeedId ?? null,
    createdAt: a.createdAt.toISOString(),
  };
}

// GET /saved
router.get("/saved", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const parsed = GetSavedArticlesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { page, limit, collection_id, search, sort } = parsed.data;
  const status = typeof req.query.status === "string" ? req.query.status : null;
  const offset = ((page ?? 1) - 1) * (limit ?? 20);

  const conditions = [eq(savedArticlesTable.userId, user.id)];

  if (collection_id != null) {
    conditions.push(eq(savedArticlesTable.collectionId, collection_id));
  }

  if (status && ["unread", "reading", "completed"].includes(status)) {
    conditions.push(eq((savedArticlesTable as any).status, status));
  }

  if (search) {
    conditions.push(
      or(
        ilike(savedArticlesTable.title, `%${search}%`),
        ilike(savedArticlesTable.verdict, `%${search}%`)
      )!
    );
  }

  const orderColumn = (() => {
    switch (sort) {
      case "recall_score": return desc(savedArticlesTable.recallScore);
      case "credibility_score": return desc(savedArticlesTable.credibilityScore);
      case "title": return asc(savedArticlesTable.title);
      default: return desc(savedArticlesTable.createdAt);
    }
  })();

  const [articles, totalResult] = await Promise.all([
    db.select().from(savedArticlesTable)
      .where(and(...conditions))
      .orderBy(orderColumn)
      .limit(limit ?? 20)
      .offset(offset),
    db.select({ count: count() }).from(savedArticlesTable).where(and(...conditions)),
  ]);

  const total = totalResult[0]?.count ?? 0;
  res.json({
    articles: articles.map(formatArticle),
    total,
    page: page ?? 1,
    totalPages: Math.ceil(total / (limit ?? 20)),
  });
});

// POST /saved
router.post("/saved", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const parsed = SaveArticleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [article] = await db.insert(savedArticlesTable).values({
    userId: user.id,
    ...parsed.data,
    bullets: parsed.data.bullets,
  }).returning();

  if (!article) {
    res.status(500).json({ error: "Failed to save article" });
    return;
  }

  // Increment monthly save count
  await db.update(usersTable)
    .set({ monthlySavesCount: sql`${usersTable.monthlySavesCount} + 1` })
    .where(eq(usersTable.id, user.id));

  res.status(201).json(formatArticle(article));
});

// GET /saved/:id
router.get("/saved/:id", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetSavedArticleParams.safeParse({ id: parseInt(rawId ?? "0", 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [article] = await db.select().from(savedArticlesTable)
    .where(and(eq(savedArticlesTable.id, params.data.id), eq(savedArticlesTable.userId, user.id)));

  if (!article) {
    res.status(404).json({ error: "Article not found" });
    return;
  }

  res.json(formatArticle(article));
});

// DELETE /saved/:id
router.delete("/saved/:id", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteSavedArticleParams.safeParse({ id: parseInt(rawId ?? "0", 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db.delete(savedArticlesTable)
    .where(and(eq(savedArticlesTable.id, params.data.id), eq(savedArticlesTable.userId, user.id)))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Article not found" });
    return;
  }

  res.sendStatus(204);
});

// PUT /saved/:id/collection
router.put("/saved/:id/collection", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateArticleCollectionParams.safeParse({ id: parseInt(rawId ?? "0", 10) });
  const body = UpdateArticleCollectionBody.safeParse(req.body);

  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const [updated] = await db.update(savedArticlesTable)
    .set({ collectionId: body.data.collectionId ?? null })
    .where(and(eq(savedArticlesTable.id, params.data.id), eq(savedArticlesTable.userId, user.id)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Article not found" });
    return;
  }

  res.json(formatArticle(updated));
});

// POST /saved/:id/share
router.post("/saved/:id/share", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = ShareArticleParams.safeParse({ id: parseInt(rawId ?? "0", 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const shareToken = uuidv4().replace(/-/g, "");
  const [updated] = await db.update(savedArticlesTable)
    .set({ shareToken, isPublic: true })
    .where(and(eq(savedArticlesTable.id, params.data.id), eq(savedArticlesTable.userId, user.id)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Article not found" });
    return;
  }

  const domain = process.env.REPLIT_DEV_DOMAIN ?? "localhost";
  res.json({
    shareToken,
    shareUrl: `https://${domain}/share/${shareToken}`,
  });
});

// GET /share/:token
router.get("/share/:token", async (req, res): Promise<void> => {
  const rawToken = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
  const params = GetSharedArticleParams.safeParse({ token: rawToken });
  if (!params.success) {
    res.status(400).json({ error: "Invalid token" });
    return;
  }

  const [article] = await db.select().from(savedArticlesTable)
    .where(and(eq(savedArticlesTable.shareToken, params.data.token), eq(savedArticlesTable.isPublic, true)));

  if (!article) {
    res.status(404).json({ error: "Shared article not found" });
    return;
  }

  res.json(formatArticle(article));
});

// GET /saved/stats
router.get("/saved/stats", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;

  const [statsResult, recentSaves, topics] = await Promise.all([
    db.select({
      total: count(),
      avgRecall: avg(savedArticlesTable.recallScore),
      avgCredibility: avg(savedArticlesTable.credibilityScore),
    }).from(savedArticlesTable).where(eq(savedArticlesTable.userId, user.id)),

    db.select().from(savedArticlesTable)
      .where(eq(savedArticlesTable.userId, user.id))
      .orderBy(desc(savedArticlesTable.createdAt))
      .limit(3),

    db.select({ count: count() }).from(savedArticlesTable).where(eq(savedArticlesTable.userId, user.id)),
  ]);

  const stats = statsResult[0] ?? { total: 0, avgRecall: 0, avgCredibility: 0 };

  res.json({
    totalSaves: stats.total,
    monthlySaves: user.monthlySavesCount,
    savesLimit: user.savesLimit,
    avgRecallScore: Number(stats.avgRecall ?? 0),
    avgCredibilityScore: Number(stats.avgCredibility ?? 0),
    topTopics: [],
    recentSaves: recentSaves.map(formatArticle),
  });
});

// GET /review/due
router.get("/review/due", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const now = new Date();

  const articles = await db.select().from(savedArticlesTable)
    .where(and(
      eq(savedArticlesTable.userId, user.id),
      sql`(${savedArticlesTable.nextReviewAt} IS NULL OR ${savedArticlesTable.nextReviewAt} <= ${now})`
    ))
    .orderBy(asc(savedArticlesTable.nextReviewAt))
    .limit(10);

  res.json(articles.map(formatArticle));
});

// POST /review/:id/complete
router.post("/review/:id/complete", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = CompleteReviewParams.safeParse({ id: parseInt(rawId ?? "0", 10) });
  const body = CompleteReviewBody.safeParse(req.body);

  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const [article] = await db.select().from(savedArticlesTable)
    .where(and(eq(savedArticlesTable.id, params.data.id), eq(savedArticlesTable.userId, user.id)));

  if (!article) {
    res.status(404).json({ error: "Article not found" });
    return;
  }

  // Spaced repetition intervals: 1, 3, 7, 14, 30, 90 days
  const intervals = [1, 3, 7, 14, 30, 90];
  const nextInterval = body.data.remembered
    ? intervals[Math.min(article.reviewCount, intervals.length - 1)] ?? 90
    : 1;

  const nextReviewAt = new Date();
  nextReviewAt.setDate(nextReviewAt.getDate() + nextInterval);

  const [updated] = await db.update(savedArticlesTable)
    .set({
      lastReviewedAt: new Date(),
      reviewCount: body.data.remembered ? article.reviewCount + 1 : 0,
      nextReviewAt,
    })
    .where(eq(savedArticlesTable.id, params.data.id))
    .returning();

  res.json(formatArticle(updated!));
});

export default router;
