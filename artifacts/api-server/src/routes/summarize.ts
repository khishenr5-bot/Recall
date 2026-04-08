import { Router } from "express";
import { db, usersTable, savedArticlesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { scrapeUrl } from "../lib/scraper";
import {
  generateSummary,
  generateSuggestedQuestions,
  askQuestion,
  askLibraryQuestion,
  generateRabbitHole,
} from "../lib/ai";
import {
  SummarizeBody,
  SuggestQuestionsBody,
  AskAboutContentBody,
  AskLibraryBody,
  GetRabbitHoleBody,
} from "@workspace/api-zod";

const router = Router();

router.post("/summarize", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;

  // Check usage limit for free users
  if (user.plan === "free" && user.monthlySavesCount >= user.savesLimit) {
    res.status(429).json({ error: `Monthly limit of ${user.savesLimit} saves reached. Upgrade to Pro for unlimited access.` });
    return;
  }

  const parsed = SummarizeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { url, preferredLanguage } = parsed.data;

  if (!url) {
    res.status(400).json({ error: "URL is required" });
    return;
  }

  req.log.info({ url }, "Summarizing URL");

  const scraped = await scrapeUrl(url);
  const summary = await generateSummary(scraped.content, scraped.title, preferredLanguage ?? user.preferredLanguage);

  res.json({
    title: scraped.title,
    verdict: summary.verdict,
    bullets: summary.bullets,
    articleText: scraped.content.slice(0, 10000),
    language: summary.language,
    recallScore: summary.recallScore,
    credibilityScore: summary.credibilityScore,
    credibilityVerdict: summary.credibilityVerdict,
    url,
    sourceType: scraped.sourceType,
  });
});

router.post("/summarize/suggest-questions", requireAuth, async (req, res): Promise<void> => {
  const parsed = SuggestQuestionsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { title, verdict, bullets } = parsed.data;
  const questions = await generateSuggestedQuestions(title, verdict, bullets);
  res.json({ questions });
});

router.post("/summarize/ask", requireAuth, async (req, res): Promise<void> => {
  const parsed = AskAboutContentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { question, title, verdict, bullets, articleText } = parsed.data;
  const result = await askQuestion(question, { title, verdict, bullets, articleText });
  res.json(result);
});

router.post("/saved/ask", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const parsed = AskLibraryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const articles = await db
    .select({
      id: savedArticlesTable.id,
      title: savedArticlesTable.title,
      verdict: savedArticlesTable.verdict,
      bullets: savedArticlesTable.bullets,
    })
    .from(savedArticlesTable)
    .where(eq(savedArticlesTable.userId, user.id))
    .limit(30);

  const result = await askLibraryQuestion(parsed.data.question, articles.map(a => ({
    id: a.id,
    title: a.title,
    verdict: a.verdict,
    bullets: a.bullets as string[],
  })));
  res.json(result);
});

router.post("/saved/rabbit-hole", requireAuth, async (req, res): Promise<void> => {
  const parsed = GetRabbitHoleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { title, verdict, bullets } = parsed.data;
  const suggestions = await generateRabbitHole(title, verdict, bullets);
  res.json({ suggestions });
});

export default router;
