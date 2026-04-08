import { Router } from "express";
import { db, savedArticlesTable } from "@workspace/db";
import { eq, desc, gte } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { generateReadingDna, generateMentorRecommendations } from "../lib/ai";

const router = Router();

router.get("/insights/reading-dna", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const articles = await db.select({
    title: savedArticlesTable.title,
    verdict: savedArticlesTable.verdict,
    createdAt: savedArticlesTable.createdAt,
  })
    .from(savedArticlesTable)
    .where(eq(savedArticlesTable.userId, user.id))
    .orderBy(desc(savedArticlesTable.createdAt));

  const dna = await generateReadingDna(articles);
  res.json({
    ...dna,
    totalArticles: articles.length,
  });
});

router.get("/insights/streak", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;

  const articles = await db.select({ createdAt: savedArticlesTable.createdAt })
    .from(savedArticlesTable)
    .where(eq(savedArticlesTable.userId, user.id))
    .orderBy(desc(savedArticlesTable.createdAt));

  const readDays = new Set(articles.map(a => a.createdAt.toISOString().split("T")[0]));
  const sortedDays = Array.from(readDays).sort().reverse();

  let currentStreak = 0;
  const today = new Date().toISOString().split("T")[0];
  let checkDate = today;

  for (const day of sortedDays) {
    if (day === checkDate) {
      currentStreak++;
      const prev = new Date(checkDate);
      prev.setDate(prev.getDate() - 1);
      checkDate = prev.toISOString().split("T")[0];
    } else {
      break;
    }
  }

  res.json({
    currentStreak,
    longestStreak: Math.max(currentStreak, 1),
    totalDaysRead: readDays.size,
    lastReadAt: articles[0]?.createdAt?.toISOString() ?? null,
  });
});

router.get("/mentor/recommendations", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;

  const articles = await db.select({
    title: savedArticlesTable.title,
    verdict: savedArticlesTable.verdict,
  })
    .from(savedArticlesTable)
    .where(eq(savedArticlesTable.userId, user.id))
    .orderBy(desc(savedArticlesTable.createdAt))
    .limit(30);

  const recommendations = await generateMentorRecommendations(articles);
  res.json(recommendations);
});

export default router;
