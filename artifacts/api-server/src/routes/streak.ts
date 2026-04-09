import { Router } from "express";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { db, usersTable, savedArticlesTable } from "@workspace/db";
import { eq, and, gte, sql } from "drizzle-orm";

const router = Router();

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

// PUT /saved/:id/status
router.put("/saved/:id/status", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const articleId = Number(req.params.id);
  const status = String(req.body?.status ?? "");
  const progress = Number(req.body?.readingProgress ?? 0);
  const validStatuses = ["unread", "reading", "completed"];
  if (!validStatuses.includes(status)) { res.status(400).json({ error: "Invalid status" }); return; }

  const [updated] = await db.update(savedArticlesTable)
    .set({ status, readingProgress: progress })
    .where(and(eq(savedArticlesTable.id, articleId), eq(savedArticlesTable.userId, user.id)))
    .returning();
  if (!updated) { res.status(404).json({ error: "Article not found" }); return; }

  res.json({ article: updated });
});

// POST /streak/check — call this whenever user saves or reviews an article
router.post("/streak/check", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const today = todayStr();
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

  let { dailyStreak, bestStreak, lastActiveDate } = user as any;
  dailyStreak = dailyStreak ?? 0;
  bestStreak = bestStreak ?? 0;

  let newStreak = dailyStreak;

  if (lastActiveDate === today) {
    // Already active today — no change
  } else if (lastActiveDate === yesterday) {
    // Consecutive day
    newStreak = dailyStreak + 1;
  } else {
    // Streak broken
    newStreak = 1;
  }

  const newBest = Math.max(bestStreak, newStreak);

  const [updated] = await db.update(usersTable)
    .set({ dailyStreak: newStreak, bestStreak: newBest, lastActiveDate: today })
    .where(eq(usersTable.id, user.id))
    .returning();

  res.json({ streak: newStreak, bestStreak: newBest, lastActiveDate: today });
});

// GET /streak — get current streak info
router.get("/streak", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user as any;
  const today = todayStr();

  // Count articles saved this week (Mon-Sun)
  const monday = new Date();
  monday.setDate(monday.getDate() - monday.getDay() + (monday.getDay() === 0 ? -6 : 1));
  monday.setHours(0, 0, 0, 0);

  const [weekCount] = await db.select({ count: sql<number>`count(*)::int` })
    .from(savedArticlesTable)
    .where(and(eq(savedArticlesTable.userId, user.id), gte(savedArticlesTable.createdAt, monday)));

  res.json({
    streak: user.dailyStreak ?? 0,
    bestStreak: user.bestStreak ?? 0,
    lastActiveDate: user.lastActiveDate,
    weeklyGoal: user.weeklyReadingGoal ?? 7,
    weeklyProgress: weekCount?.count ?? 0,
    isActiveToday: user.lastActiveDate === today,
  });
});

// PATCH /streak/goal — update weekly reading goal
router.patch("/streak/goal", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const goal = Number(req.body?.weeklyReadingGoal);
  if (!goal || goal < 1 || goal > 100) { res.status(400).json({ error: "Goal must be 1-100" }); return; }
  await db.update(usersTable).set({ weeklyReadingGoal: goal }).where(eq(usersTable.id, user.id));
  res.json({ weeklyReadingGoal: goal });
});

export default router;
