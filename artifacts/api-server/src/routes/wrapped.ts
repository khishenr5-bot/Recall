import { Router } from "express";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { db, savedArticlesTable, highlightsTable } from "@workspace/db";
import { eq, and, gte, lte, desc, sql, count } from "drizzle-orm";

const router = Router();

router.get("/wrapped/:year", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const year = Number(req.params.year);
  if (!year || year < 2020 || year > 2030) { res.status(400).json({ error: "Invalid year" }); return; }

  const start = new Date(`${year}-01-01T00:00:00Z`);
  const end = new Date(`${year}-12-31T23:59:59Z`);

  const [articles, hlCount] = await Promise.all([
    db.select().from(savedArticlesTable)
      .where(and(eq(savedArticlesTable.userId, user.id), gte(savedArticlesTable.createdAt, start), lte(savedArticlesTable.createdAt, end)))
      .orderBy(savedArticlesTable.createdAt),
    db.select({ count: sql<number>`count(*)::int` }).from(highlightsTable).where(eq(highlightsTable.userId, user.id)),
  ]);

  const totalArticles = articles.length;
  const totalReadingTimeSaved = totalArticles * 10; // 10 min estimate per article

  // Count by domain
  const domainCounts: Record<string, number> = {};
  for (const a of articles) {
    if (a.url) {
      try {
        const domain = new URL(a.url).hostname.replace("www.", "");
        domainCounts[domain] = (domainCounts[domain] || 0) + 1;
      } catch {}
    }
  }
  const mostSavedDomain = Object.entries(domainCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  // Count by topic (rough from sourceType / title keywords)
  const topicCounts: Record<string, number> = {};
  const keywords: Record<string, string[]> = {
    "Technology": ["ai", "tech", "software", "code", "programming", "developer", "startup", "app"],
    "Science": ["science", "research", "study", "physics", "biology", "climate", "space"],
    "Business": ["business", "startup", "investment", "economy", "market", "finance"],
    "Health": ["health", "mental", "fitness", "medical", "wellness", "diet"],
    "Politics": ["politics", "government", "election", "policy", "president"],
    "Culture": ["culture", "art", "music", "film", "design", "creative"],
    "Productivity": ["productivity", "habits", "learning", "focus", "goal"],
  };

  for (const a of articles) {
    const lower = (a.title + " " + (a.verdict ?? "")).toLowerCase();
    let matched = false;
    for (const [topic, kws] of Object.entries(keywords)) {
      if (kws.some(k => lower.includes(k))) {
        topicCounts[topic] = (topicCounts[topic] || 0) + 1;
        matched = true;
        break;
      }
    }
    if (!matched) topicCounts["General"] = (topicCounts["General"] || 0) + 1;
  }

  const topTopics = Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([topic, count]) => ({ topic, count }));

  // Streak calculation from saved_articles dates
  const dates = [...new Set(articles.map(a => a.createdAt.toISOString().split("T")[0]))].sort();
  let longestStreak = 0, currentStreak = 0;
  for (let i = 0; i < dates.length; i++) {
    if (i === 0 || new Date(dates[i]).getTime() - new Date(dates[i - 1]).getTime() === 86400000) {
      currentStreak++;
    } else {
      currentStreak = 1;
    }
    longestStreak = Math.max(longestStreak, currentStreak);
  }

  res.json({
    year,
    totalArticles,
    totalReadingTimeSaved,
    topTopics,
    mostSavedDomain,
    longestStreak,
    totalHighlights: hlCount[0]?.count ?? 0,
    firstArticle: articles[0] ? { title: articles[0].title, url: articles[0].url, createdAt: articles[0].createdAt } : null,
    mostRecentArticle: articles[articles.length - 1] ? { title: articles[articles.length - 1].title, url: articles[articles.length - 1].url } : null,
    sourceBreakdown: {
      url: articles.filter(a => a.sourceType === "url").length,
      youtube: articles.filter(a => a.sourceType === "youtube").length,
      file: articles.filter(a => a.sourceType === "file").length,
      rss: articles.filter(a => a.sourceType === "rss").length,
    },
  });
});

export default router;
