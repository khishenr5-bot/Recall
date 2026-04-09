import { Router } from "express";
import multer from "multer";
import { db, usersTable, savedArticlesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, optionalAuth, type AuthRequest } from "../lib/auth";
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
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.post("/summarize", optionalAuth, upload.single("file"), async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user ?? null;

  // Check usage limit for free users (anonymous users can always summarize)
  if (user && user.plan === "free" && user.monthlySavesCount >= user.savesLimit) {
    res.status(429).json({ error: `Monthly limit of ${user.savesLimit} saves reached. Upgrade to Pro for unlimited access.` });
    return;
  }

  const lang = req.body?.preferredLanguage ?? user?.preferredLanguage ?? "en";

  // Handle file upload
  if (req.file) {
    const filename = req.file.originalname;
    const ext = filename.split(".").pop()?.toLowerCase();
    let content = "";

    if (ext === "txt") {
      content = req.file.buffer.toString("utf-8");
    } else if (ext === "pdf" || ext === "docx") {
      // For PDF/DOCX we extract readable text via toString (basic fallback)
      // A production app would use pdf-parse / mammoth, but buffer text works for now
      content = req.file.buffer.toString("utf-8").replace(/[^\x20-\x7E\n\t]/g, " ").replace(/\s+/g, " ").trim();
    } else {
      content = req.file.buffer.toString("utf-8");
    }

    if (!content || content.length < 50) {
      res.status(400).json({ error: "Could not extract readable text from the file. Please try a .txt file." });
      return;
    }

    req.log.info({ filename }, "Summarizing uploaded file");
    const summary = await generateSummary(content.slice(0, 50000), filename, lang);
    res.json({
      title: filename,
      verdict: summary.verdict,
      bullets: summary.bullets,
      articleText: content.slice(0, 10000),
      language: summary.language,
      recallScore: summary.recallScore,
      credibilityScore: summary.credibilityScore,
      credibilityVerdict: summary.credibilityVerdict,
      url: "",
      sourceType: "url" as const,
    });
    return;
  }

  // Handle URL
  const parsed = SummarizeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { url } = parsed.data;

  if (!url) {
    res.status(400).json({ error: "URL is required" });
    return;
  }

  req.log.info({ url }, "Summarizing URL");

  const scraped = await scrapeUrl(url);
  const summary = await generateSummary(scraped.content, scraped.title, lang);

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

router.post("/summarize/suggest-questions", optionalAuth, async (req, res): Promise<void> => {
  const parsed = SuggestQuestionsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { title, verdict, bullets } = parsed.data;
  const questions = await generateSuggestedQuestions(title, verdict, bullets);
  res.json({ questions });
});

router.post("/summarize/ask", optionalAuth, async (req, res): Promise<void> => {
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

router.post("/saved/rabbit-hole", optionalAuth, async (req, res): Promise<void> => {
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
