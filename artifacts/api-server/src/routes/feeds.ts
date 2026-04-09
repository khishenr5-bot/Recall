import { Router } from "express";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { db, rssFeedsTable, savedArticlesTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { generateSummary } from "../lib/ai";
import Parser from "rss-parser";

const router = Router();
const parser = new Parser({ timeout: 10000, maxRedirects: 5 });

async function fetchAndSummariseFeed(feedId: number, userId: number) {
  const [feed] = await db.select().from(rssFeedsTable).where(and(eq(rssFeedsTable.id, feedId), eq(rssFeedsTable.userId, userId)));
  if (!feed) return { added: 0 };

  let parsed;
  try {
    parsed = await parser.parseURL(feed.feedUrl);
  } catch {
    return { added: 0, error: "Could not fetch RSS feed" };
  }

  const items = parsed.items.slice(0, 10);
  let added = 0;

  for (const item of items) {
    const url = item.link || item.guid;
    if (!url) continue;

    const existing = await db.select({ id: savedArticlesTable.id }).from(savedArticlesTable)
      .where(and(eq(savedArticlesTable.userId, userId), eq(savedArticlesTable.url, url)));
    if (existing.length > 0) continue;

    try {
      const title = item.title || "Untitled";
      const content = item.contentSnippet || item.content || item.summary || title;
      const ai = await generateSummary(content, title);

      await db.insert(savedArticlesTable).values({
        userId, url, title: ai.verdict ? title : title,
        verdict: ai.verdict, bullets: ai.bullets,
        articleText: content.slice(0, 5000),
        recallScore: ai.recallScore, credibilityScore: ai.credibilityScore,
        credibilityVerdict: ai.credibilityVerdict, language: ai.language,
        sourceType: "rss", isRss: true, rssFeedId: feedId,
        status: "unread", readingProgress: 0,
      });
      added++;
    } catch {}
  }

  await db.update(rssFeedsTable).set({
    lastFetchedAt: new Date(),
    articleCount: feed.articleCount + added,
  }).where(eq(rssFeedsTable.id, feedId));

  return { added };
}

// GET /feeds
router.get("/feeds", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const feeds = await db.select().from(rssFeedsTable)
    .where(eq(rssFeedsTable.userId, user.id))
    .orderBy(desc(rssFeedsTable.createdAt));
  res.json({ feeds });
});

// POST /feeds
router.post("/feeds", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const feedUrl = String(req.body?.feedUrl ?? "").trim();
  if (!feedUrl) { res.status(400).json({ error: "feedUrl is required" }); return; }

  let parsed;
  try {
    parsed = await parser.parseURL(feedUrl);
  } catch {
    res.status(400).json({ error: "Could not fetch or parse this RSS feed URL" }); return;
  }

  const feedName = parsed.title || new URL(feedUrl).hostname;
  const [feed] = await db.insert(rssFeedsTable).values({
    userId: user.id, feedUrl, feedName, isActive: true, articleCount: 0,
  }).returning();

  // Kick off async summarisation (don't await so response is fast)
  fetchAndSummariseFeed(feed.id, user.id).catch(() => {});

  res.status(201).json({ feed });
});

// GET /feeds/:id/articles — trigger fetch + summarise for this feed
router.get("/feeds/:id/articles", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const feedId = Number(req.params.id);
  if (!feedId) { res.status(400).json({ error: "Invalid feed id" }); return; }

  const result = await fetchAndSummariseFeed(feedId, user.id);
  res.json(result);
});

// POST /feeds/refresh — refresh all active feeds for user
router.post("/feeds/refresh", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const feeds = await db.select().from(rssFeedsTable)
    .where(and(eq(rssFeedsTable.userId, user.id), eq(rssFeedsTable.isActive, true)));

  let totalAdded = 0;
  for (const feed of feeds) {
    const result = await fetchAndSummariseFeed(feed.id, user.id);
    totalAdded += result.added || 0;
  }
  res.json({ refreshed: feeds.length, added: totalAdded });
});

// DELETE /feeds/:id
router.delete("/feeds/:id", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const feedId = Number(req.params.id);
  await db.delete(rssFeedsTable).where(and(eq(rssFeedsTable.id, feedId), eq(rssFeedsTable.userId, user.id)));
  res.json({ success: true });
});

export default router;
