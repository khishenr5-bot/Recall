import { Router } from "express";
import multer from "multer";
import { db, usersTable, savedArticlesTable, importedMemoriesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, optionalAuth, type AuthRequest } from "../lib/auth";
import { scrapeUrl } from "../lib/scraper";
import {
  generateSummary,
  generateSuggestedQuestions,
  askQuestion,
  askLibraryQuestion,
  generateRabbitHole,
  generateChapterSummary,
  generateBookSummary,
} from "../lib/ai";
import { writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
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

    // EPUB book handling
    if (ext === "epub" || req.file.mimetype === "application/epub+zip") {
      const tmpPath = join(tmpdir(), `recall-${Date.now()}.epub`);
      try {
        writeFileSync(tmpPath, req.file.buffer);
        const EPub = (await import("epub2")).default;
        const epub = await (EPub as any).createAsync(tmpPath);

        const bookTitle = epub.metadata?.title || filename.replace(/\.epub$/i, "");
        const author = epub.metadata?.creator || epub.metadata?.author || "";

        // Get all content items in reading order
        const flow: any[] = epub.flow ?? [];
        const chapters: Array<{ title: string; text: string }> = [];

        for (const item of flow) {
          try {
            const raw: string = await epub.getChapterRawAsync(item.id);
            // Strip HTML tags
            const text = raw
              .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
              .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
              .replace(/<[^>]+>/g, " ")
              .replace(/&nbsp;/g, " ")
              .replace(/&amp;/g, "&")
              .replace(/&lt;/g, "<")
              .replace(/&gt;/g, ">")
              .replace(/&quot;/g, '"')
              .replace(/\s+/g, " ")
              .trim();
            if (text.length > 200) {
              chapters.push({ title: item.title || `Chapter ${chapters.length + 1}`, text });
            }
          } catch {}
        }

        if (chapters.length === 0) throw new Error("No readable chapters found");

        req.log.info({ bookTitle, chapters: chapters.length }, "Summarizing EPUB book");

        // Summarise each chapter in sequence (parallelising would hit rate limits)
        const chapterSummaries: Array<{ title: string; verdict: string; bullets: string[] }> = [];
        for (const ch of chapters) {
          const s = await generateChapterSummary(ch.text, ch.title, bookTitle);
          chapterSummaries.push({ title: ch.title, ...s });
        }

        const bookSummary = await generateBookSummary(bookTitle, author, chapterSummaries);

        unlinkSync(tmpPath);

        res.json({
          title: bookTitle,
          verdict: bookSummary.verdict,
          bullets: bookSummary.bullets,
          articleText: chapters.map(c => c.text).join("\n\n").slice(0, 10000),
          language: lang,
          recallScore: bookSummary.recallScore,
          credibilityScore: bookSummary.credibilityScore,
          credibilityVerdict: bookSummary.credibilityVerdict,
          url: "",
          sourceType: "file" as const,
          bookAuthor: author,
          chapterCount: chapterSummaries.length,
          chapters: chapterSummaries,
        });
        return;
      } catch (err) {
        try { unlinkSync(tmpPath); } catch {}
        res.status(400).json({ error: "Could not parse EPUB file. Make sure it's a valid EPUB book." });
        return;
      }
    }

    if (ext === "txt") {
      content = req.file.buffer.toString("utf-8");
    } else if (ext === "pdf" || ext === "docx") {
      // For PDF/DOCX we extract readable text via toString (basic fallback)
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

  // Fetch imported memories to enrich the context
  const memories = await db
    .select({ id: importedMemoriesTable.id, source: importedMemoriesTable.source, summary: importedMemoriesTable.summary, content: importedMemoriesTable.content })
    .from(importedMemoriesTable)
    .where(eq(importedMemoriesTable.userId, user.id))
    .limit(20);

  const memoryArticles = memories.map(m => ({
    id: -m.id,
    title: `[Memory from ${m.source}]`,
    verdict: m.summary ?? m.content.slice(0, 120),
    bullets: [m.content.slice(0, 300)],
  }));

  const result = await askLibraryQuestion(parsed.data.question, [
    ...articles.map(a => ({ id: a.id, title: a.title, verdict: a.verdict, bullets: a.bullets as string[] })),
    ...memoryArticles,
  ]);
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
