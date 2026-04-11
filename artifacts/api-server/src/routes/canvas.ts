import { Router } from "express";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { db, savedArticlesTable, canvasSessionsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";

const router = Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// GET all canvas sessions
router.get("/canvas", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const sessions = await db.select({
    id: canvasSessionsTable.id,
    title: canvasSessionsTable.title,
    problem: canvasSessionsTable.problem,
    createdAt: canvasSessionsTable.createdAt,
    updatedAt: canvasSessionsTable.updatedAt,
  }).from(canvasSessionsTable)
    .where(eq(canvasSessionsTable.userId, user.id))
    .orderBy(desc(canvasSessionsTable.updatedAt));
  res.json({ sessions });
});

// GET single canvas session
router.get("/canvas/:id", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const [session] = await db.select().from(canvasSessionsTable)
    .where(and(eq(canvasSessionsTable.id, Number(req.params.id)), eq(canvasSessionsTable.userId, user.id)));
  if (!session) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ session });
});

// POST create new canvas session
router.post("/canvas", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const { problem } = req.body;
  if (!problem?.trim()) { res.status(400).json({ error: "problem is required" }); return; }

  const articles = await db.select({
    id: savedArticlesTable.id,
    title: savedArticlesTable.title,
    verdict: savedArticlesTable.verdict,
    bullets: savedArticlesTable.bullets,
  }).from(savedArticlesTable)
    .where(eq(savedArticlesTable.userId, user.id))
    .orderBy(desc(savedArticlesTable.createdAt))
    .limit(20);

  const libraryContext = articles.length
    ? articles.map((a, i) => `[${i + 1}] ${a.title}: ${a.verdict ?? ""}`).join("\n")
    : "No saved articles yet.";

  const systemPrompt = `You are a strategic thinking partner for a founder. Be direct, practical, and honest. Reference their knowledge library when relevant.`;

  const userMessage = `I'm working through this problem or decision: "${problem}"

My knowledge library contains:
${libraryContext}

Help me think through this clearly. Structure your response as:

PERSPECTIVE: [Your honest 2-3 sentence take on this problem]

WHAT YOUR LIBRARY SAYS:
[Reference 2-3 specific articles that are relevant and how each applies]

KEY QUESTIONS TO CONSIDER:
1. [Important question to answer]
2. [Important question to answer]
3. [Important question to answer]

RECOMMENDED NEXT STEP: [One concrete action to take this week]`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20251001",
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }]
    });

    const aiResponse = response.content[0].type === "text" ? response.content[0].text : "";
    const title = problem.slice(0, 60) + (problem.length > 60 ? "…" : "");
    const linkedArticleIds = articles.slice(0, 3).map(a => a.id);
    const messages = [
      { role: "user" as const, content: problem },
      { role: "assistant" as const, content: aiResponse }
    ];

    const [session] = await db.insert(canvasSessionsTable).values({
      userId: user.id,
      title,
      problem,
      messages,
      linkedArticleIds,
    }).returning();

    res.json({ session });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    res.status(500).json({ error: message });
  }
});

// POST continue conversation in canvas session
router.post("/canvas/:id/message", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const { message: userMessage } = req.body;
  if (!userMessage?.trim()) { res.status(400).json({ error: "message is required" }); return; }

  const [session] = await db.select().from(canvasSessionsTable)
    .where(and(eq(canvasSessionsTable.id, Number(req.params.id)), eq(canvasSessionsTable.userId, user.id)));
  if (!session) { res.status(404).json({ error: "Not found" }); return; }

  const history = (session.messages as { role: "user" | "assistant"; content: string }[]) ?? [];
  history.push({ role: "user", content: userMessage });

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20251001",
    max_tokens: 1000,
    system: "You are a strategic thinking partner for a founder. Be direct, practical, and honest. Reference their previous thoughts when relevant.",
    messages: history
  });

  const aiResponse = response.content[0].type === "text" ? response.content[0].text : "";
  history.push({ role: "assistant", content: aiResponse });

  await db.update(canvasSessionsTable)
    .set({ messages: history })
    .where(eq(canvasSessionsTable.id, session.id));

  res.json({ response: aiResponse, messages: history });
});

// DELETE canvas session
router.delete("/canvas/:id", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  await db.delete(canvasSessionsTable)
    .where(and(eq(canvasSessionsTable.id, Number(req.params.id)), eq(canvasSessionsTable.userId, user.id)));
  res.json({ success: true });
});

export default router;
