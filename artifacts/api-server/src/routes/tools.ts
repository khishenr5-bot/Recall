import { Router } from "express";
import { optionalAuth, requireAuth, type AuthRequest } from "../lib/auth";
import { db, savedArticlesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  generateFlashcards,
  generateQuiz,
  generateInfographic,
  generateSlides,
  generateDeepResearch,
} from "../lib/ai";

const router = Router();

// Shared input validator
function getArticleInput(body: any) {
  const title = String(body?.title ?? "").trim();
  const verdict = String(body?.verdict ?? "").trim();
  const bullets: string[] = Array.isArray(body?.bullets) ? body.bullets : [];
  if (!title) return null;
  return { title, verdict, bullets };
}

router.post("/flashcards", optionalAuth, async (req, res): Promise<void> => {
  const input = getArticleInput(req.body);
  if (!input) { res.status(400).json({ error: "title is required" }); return; }
  const cards = await generateFlashcards(input.title, input.verdict, input.bullets);
  res.json({ flashcards: cards });
});

router.post("/quiz", optionalAuth, async (req, res): Promise<void> => {
  const input = getArticleInput(req.body);
  if (!input) { res.status(400).json({ error: "title is required" }); return; }
  const questions = await generateQuiz(input.title, input.verdict, input.bullets);
  res.json({ questions });
});

router.post("/infographic", optionalAuth, async (req, res): Promise<void> => {
  const input = getArticleInput(req.body);
  if (!input) { res.status(400).json({ error: "title is required" }); return; }
  const data = await generateInfographic(input.title, input.verdict, input.bullets);
  res.json(data);
});

router.post("/slides", optionalAuth, async (req, res): Promise<void> => {
  const input = getArticleInput(req.body);
  if (!input) { res.status(400).json({ error: "title is required" }); return; }
  const instructions = typeof req.body?.instructions === "string" ? req.body.instructions : undefined;
  const slides = await generateSlides(input.title, input.verdict, input.bullets, instructions);
  res.json({ slides });
});

router.post("/deep-research", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const question = String(req.body?.question ?? "").trim();
  if (!question) { res.status(400).json({ error: "question is required" }); return; }

  const articles = await db
    .select({
      id: savedArticlesTable.id,
      title: savedArticlesTable.title,
      verdict: savedArticlesTable.verdict,
      bullets: savedArticlesTable.bullets,
    })
    .from(savedArticlesTable)
    .where(eq(savedArticlesTable.userId, user.id))
    .limit(25);

  const result = await generateDeepResearch(
    question,
    articles.map(a => ({ id: a.id, title: a.title, verdict: a.verdict, bullets: a.bullets as string[] }))
  );
  res.json(result);
});

export default router;
