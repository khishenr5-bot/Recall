import { Router } from "express";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { db, savedArticlesTable, usersTable } from "@workspace/db";
import { eq, and, gte, sql } from "drizzle-orm";
import { createHash } from "crypto";
import { generateSummary, generateText } from "../lib/ai";
import { scrapeUrl } from "../lib/scraper";
import Anthropic from "@anthropic-ai/sdk";

const router = Router();

function md5(text: string) {
  return createHash("md5").update(text).digest("hex");
}

function contentChangedSignificantly(oldHash: string | null, newText: string, oldText?: string | null): boolean {
  const newHash = md5(newText);
  if (!oldHash) return false;
  if (oldHash === newHash) return false;

  // Simple change percentage estimate: compare lengths
  const oldLen = oldText?.length ?? 0;
  const newLen = newText.length;
  if (oldLen === 0) return false;
  const changePct = Math.abs(newLen - oldLen) / oldLen;
  return changePct > 0.10; // >10% length change
}

// PATCH /saved/:id/track — toggle tracking
router.patch("/saved/:id/track", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const articleId = Number(req.params.id);
  const track = Boolean(req.body?.trackChanges ?? true);

  const [updated] = await db.update(savedArticlesTable as any)
    .set({ trackChanges: track })
    .where(and(eq(savedArticlesTable.id, articleId), eq(savedArticlesTable.userId, user.id)))
    .returning();

  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ trackChanges: track });
});

// POST /articles/check-updates — check all tracked articles for changes
router.post("/articles/check-updates", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000);

  const articles = await db.select().from(savedArticlesTable)
    .where(and(
      eq(savedArticlesTable.userId, user.id),
      gte(savedArticlesTable.createdAt, ninetyDaysAgo),
    ));

  const tracked = articles.filter(a => a.url && (a as any).trackChanges !== false);
  let changed = 0;

  for (const article of tracked) {
    if (!article.url) continue;
    try {
      const scraped = await scrapeUrl(article.url);
      if (!scraped?.content || scraped.content.length < 100) continue;

      const storedHash = (article as any).lastContentHash;
      if (!contentChangedSignificantly(storedHash, scraped.content, article.articleText)) {
        // Still update hash if none stored
        if (!storedHash) {
          await db.update(savedArticlesTable as any).set({ lastContentHash: md5(scraped.content) })
            .where(eq(savedArticlesTable.id, article.id));
        }
        continue;
      }

      // Significant change detected — re-summarise
      const newSummary = await generateSummary(scraped.content, scraped.title || article.title);

      // Generate a human-readable change summary
      const changeSummary = await generateText(
        `An article was updated. Compare the old and new verdicts and summarize the change in 1-2 sentences for the reader.
Old verdict: ${article.verdict}
New verdict: ${newSummary.verdict}
Be specific about what changed. Start with "This article was updated —"`
      ).catch(() => "This article was updated since you last saved it.");

      await db.update(savedArticlesTable as any).set({
        verdict: newSummary.verdict,
        bullets: newSummary.bullets,
        recallScore: newSummary.recallScore,
        credibilityScore: newSummary.credibilityScore,
        articleText: scraped.content.slice(0, 10000),
        lastContentHash: md5(scraped.content),
        contentChangedAt: new Date(),
        changeSummary,
      }).where(eq(savedArticlesTable.id, article.id));

      changed++;
    } catch {}
  }

  res.json({ checked: tracked.length, changed });
});

// GET /articles/:id/changes
router.get("/articles/:id/changes", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const articleId = Number(req.params.id);

  const [article] = await db.select().from(savedArticlesTable)
    .where(and(eq(savedArticlesTable.id, articleId), eq(savedArticlesTable.userId, user.id)));

  if (!article) { res.status(404).json({ error: "Not found" }); return; }

  res.json({
    hasChanges: !!(article as any).contentChangedAt,
    changeSummary: (article as any).changeSummary,
    contentChangedAt: (article as any).contentChangedAt,
    trackChanges: (article as any).trackChanges ?? true,
    currentVerdict: article.verdict,
  });
});

export default router;
