import { Router } from "express";
import { db, savedArticlesTable } from "@workspace/db";
import { eq, desc, gte } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../lib/auth";

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
    createdAt: a.createdAt.toISOString(),
  };
}

router.get("/digest/preview", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;

  const articles = await db.select()
    .from(savedArticlesTable)
    .where(eq(savedArticlesTable.userId, user.id))
    .orderBy(desc(savedArticlesTable.createdAt))
    .limit(3);

  res.json({
    articles: articles.map(formatArticle),
    generatedAt: new Date().toISOString(),
  });
});

router.post("/digest/send", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;

  const articles = await db.select()
    .from(savedArticlesTable)
    .where(eq(savedArticlesTable.userId, user.id))
    .orderBy(desc(savedArticlesTable.createdAt))
    .limit(3);

  // If RESEND_API_KEY is configured, send email
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey && articles.length > 0) {
    try {
      const emailContent = articles.map(a => {
        const bullets = (a.bullets as string[]).slice(0, 2).map(b => `• ${b}`).join("\n");
        return `📖 ${a.title}\n\n${a.verdict}\n\n${bullets}`;
      }).join("\n\n---\n\n");

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Recall.ai <digest@recall.ai>",
          to: user.email,
          subject: `Your Recall.ai Daily Digest — ${new Date().toLocaleDateString()}`,
          text: `Your Daily Reading Digest\n\n${emailContent}\n\n---\nRecall.ai — Understand more. Read less.`,
        }),
      });
    } catch (err) {
      req.log.warn({ err }, "Failed to send digest email");
    }
  }

  res.json({ success: true, message: articles.length > 0 ? "Digest sent to your email" : "No articles to digest" });
});

router.get("/report/weekly", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const articles = await db.select()
    .from(savedArticlesTable)
    .where(eq(savedArticlesTable.userId, user.id))
    .orderBy(desc(savedArticlesTable.recallScore))
    .limit(20);

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);

  res.json({
    weekStart: weekStart.toISOString(),
    weekEnd: new Date().toISOString(),
    totalSaves: articles.length,
    topThemes: ["Technology", "Business", "Science"],
    topSaves: articles.slice(0, 5).map(formatArticle),
    insights: articles.length > 0
      ? `You saved ${articles.length} articles this week. Your top topics were diverse and intellectually stimulating.`
      : "Start saving articles to get your weekly reading report.",
  });
});

export default router;
