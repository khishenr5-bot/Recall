import { Router } from "express";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { db, savedArticlesTable, researchReportsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";

const router = Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// GET saved research reports
router.get("/research", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const reports = await db.select({
    id: researchReportsTable.id,
    question: researchReportsTable.question,
    executiveSummary: researchReportsTable.executiveSummary,
    createdAt: researchReportsTable.createdAt,
  }).from(researchReportsTable)
    .where(eq(researchReportsTable.userId, user.id))
    .orderBy(desc(researchReportsTable.createdAt));
  res.json({ reports });
});

// GET single research report
router.get("/research/:id", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const [report] = await db.select().from(researchReportsTable)
    .where(eq(researchReportsTable.id, Number(req.params.id)));
  if (!report || report.userId !== user.id) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ report });
});

// POST run research
router.post("/research", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const { question, fileContent } = req.body;
  if (!question?.trim()) { res.status(400).json({ error: "question is required" }); return; }

  const articles = await db.select({
    id: savedArticlesTable.id,
    title: savedArticlesTable.title,
    verdict: savedArticlesTable.verdict,
    bullets: savedArticlesTable.bullets,
  }).from(savedArticlesTable)
    .where(eq(savedArticlesTable.userId, user.id))
    .orderBy(desc(savedArticlesTable.createdAt))
    .limit(30);

  const libraryContext = articles.length > 0
    ? articles.map((a, i) =>
        `[${i + 1}] ${a.title}\nVerdict: ${a.verdict ?? ""}\nKey points: ${(a.bullets as string[] ?? []).slice(0, 3).join("; ")}`
      ).join("\n\n")
    : "No saved articles yet.";

  const documentContext = fileContent?.trim()
    ? `\n\nUploaded document context:\n${fileContent.slice(0, 8000)}\n`
    : "";

  const prompt = `You are a research assistant helping a founder answer: "${question}"
${documentContext}
Their personal knowledge library:
${libraryContext}

Write a comprehensive research report with EXACTLY this structure (use these exact section headers):

EXECUTIVE_SUMMARY:
[2-3 sentence overview]

SUB_QUESTIONS:
1. [Sub-question]
2. [Sub-question]
3. [Sub-question]
4. [Sub-question]
5. [Sub-question]

FINDINGS:
[4-6 paragraphs. Where relevant cite saved articles using [Article N] notation]

KNOWLEDGE_GAPS:
1. [Gap]
2. [Gap]
3. [Gap]

SEARCH_QUERIES:
1. [Google search query]
2. [Google search query]
3. [Google search query]

RECOMMENDED_READS:
1. [Topic]
2. [Topic]
3. [Topic]`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20251001",
      max_tokens: 3000,
      messages: [{ role: "user", content: prompt }]
    });

    const raw = message.content[0].type === "text" ? message.content[0].text : "";

    const extract = (key: string, nextKey?: string) => {
      const start = raw.indexOf(`${key}:`);
      if (start === -1) return "";
      const content = raw.slice(start + key.length + 1);
      if (!nextKey) return content.trim();
      const end = content.indexOf(`${nextKey}:`);
      return end === -1 ? content.trim() : content.slice(0, end).trim();
    };

    const parseList = (text: string) =>
      text.split("\n")
        .filter(l => l.match(/^\d+\./))
        .map(l => l.replace(/^\d+\.\s*/, "").trim())
        .filter(Boolean);

    const result = {
      question,
      executiveSummary: extract("EXECUTIVE_SUMMARY", "SUB_QUESTIONS"),
      subQuestions: parseList(extract("SUB_QUESTIONS", "FINDINGS")),
      findings: extract("FINDINGS", "KNOWLEDGE_GAPS"),
      knowledgeGaps: parseList(extract("KNOWLEDGE_GAPS", "SEARCH_QUERIES")),
      searchQueries: parseList(extract("SEARCH_QUERIES", "RECOMMENDED_READS")),
      recommendedReads: parseList(extract("RECOMMENDED_READS")),
      sources: articles.slice(0, 5).map(a => ({ id: a.id, title: a.title })),
    };

    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Research failed";
    res.status(500).json({ error: message });
  }
});

// POST save a research report
router.post("/research/save", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const { question, executiveSummary, subQuestions, findings, knowledgeGaps, searchQueries, recommendedReads, sources } = req.body;
  if (!question) { res.status(400).json({ error: "question required" }); return; }
  const [report] = await db.insert(researchReportsTable).values({
    userId: user.id,
    question,
    executiveSummary: executiveSummary ?? "",
    subQuestions: subQuestions ?? [],
    findings: findings ?? "",
    knowledgeGaps: knowledgeGaps ?? [],
    searchQueries: searchQueries ?? [],
    recommendedReads: recommendedReads ?? [],
    sources: sources ?? [],
  }).returning();
  res.status(201).json({ report });
});

// DELETE research report
router.delete("/research/:id", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const [report] = await db.select().from(researchReportsTable)
    .where(eq(researchReportsTable.id, Number(req.params.id)));
  if (!report || report.userId !== user.id) { res.status(404).json({ error: "Not found" }); return; }
  await db.delete(researchReportsTable).where(eq(researchReportsTable.id, report.id));
  res.json({ success: true });
});

export default router;
