import { Router } from "express";
import { db, actionItemsTable, actionPlansTable, savedArticlesTable, usersTable } from "@workspace/db";
import { and, asc, desc, eq, gte, inArray, sql, isNull, or, lte } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { extractActionItems, generateActionPlan } from "../lib/actions-ai";

const router = Router();

function startOfWeek(d = new Date()): string {
  // ISO week start = Monday
  const date = new Date(d);
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day; // shift Sunday to previous Monday
  date.setUTCDate(date.getUTCDate() + diff);
  return date.toISOString().slice(0, 10);
}

/**
 * GET /user/goals — current user's goals.
 */
router.get("/user/goals", requireAuth, async (req, res) => {
  const user = (req as AuthRequest).user;
  const [u] = await db.select({ goals: usersTable.goals }).from(usersTable).where(eq(usersTable.id, user.id));
  res.json({ goals: u?.goals ?? "" });
});

/**
 * PATCH /user/goals — update user's goals string.
 */
router.patch("/user/goals", requireAuth, async (req, res) => {
  const user = (req as AuthRequest).user;
  const goals = typeof req.body?.goals === "string" ? req.body.goals.slice(0, 2000) : "";
  await db.update(usersTable).set({ goals }).where(eq(usersTable.id, user.id));
  res.json({ goals });
});

/**
 * POST /actions/extract/:articleId
 * Extracts action items from an already-saved article and stores them.
 * Idempotent: if actionItemsExtracted is true, returns existing items.
 */
router.post("/actions/extract/:articleId", requireAuth, async (req, res) => {
  const user = (req as AuthRequest).user;
  const articleId = parseInt(String(req.params.articleId), 10);
  if (!articleId) {
    res.status(400).json({ error: "Invalid articleId" });
    return;
  }

  const [article] = await db
    .select()
    .from(savedArticlesTable)
    .where(and(eq(savedArticlesTable.id, articleId), eq(savedArticlesTable.userId, user.id)));

  if (!article) {
    res.status(404).json({ error: "Article not found" });
    return;
  }

  if (article.actionItemsExtracted) {
    const items = await db
      .select()
      .from(actionItemsTable)
      .where(eq(actionItemsTable.articleId, articleId));
    res.json({ intentType: article.intentType, items });
    return;
  }

  try {
    const bullets = Array.isArray(article.bullets) ? (article.bullets as string[]) : [];
    const extracted = await extractActionItems(article.title, bullets);

    await db
      .update(savedArticlesTable)
      .set({ intentType: extracted.intentType, actionItemsExtracted: true })
      .where(eq(savedArticlesTable.id, articleId));

    let inserted: any[] = [];
    if (extracted.actions.length) {
      inserted = await db
        .insert(actionItemsTable)
        .values(
          extracted.actions.map((action) => ({
            userId: user.id,
            articleId,
            action,
            intentType: extracted.intentType,
          }))
        )
        .returning();
    }

    res.json({ intentType: extracted.intentType, items: inserted });
  } catch (err: any) {
    req.log?.error?.({ err }, "Action extraction failed");
    res.status(500).json({ error: "Extraction failed" });
  }
});

/**
 * POST /action-plan/generate
 * Body: { goals?: string }
 * Generates and stores a weekly action plan based on pending action items.
 */
router.post("/action-plan/generate", requireAuth, async (req, res) => {
  const user = (req as AuthRequest).user;
  const goalsOverride = typeof req.body?.goals === "string" ? req.body.goals : null;

  const [u] = await db.select({ goals: usersTable.goals }).from(usersTable).where(eq(usersTable.id, user.id));
  const goals = goalsOverride ?? u?.goals ?? "";

  if (goalsOverride !== null) {
    await db.update(usersTable).set({ goals: goalsOverride }).where(eq(usersTable.id, user.id));
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const pending = await db
    .select({
      id: actionItemsTable.id,
      action: actionItemsTable.action,
      intentType: actionItemsTable.intentType,
      articleTitle: savedArticlesTable.title,
    })
    .from(actionItemsTable)
    .leftJoin(savedArticlesTable, eq(actionItemsTable.articleId, savedArticlesTable.id))
    .where(
      and(
        eq(actionItemsTable.userId, user.id),
        eq(actionItemsTable.status, "pending"),
        gte(actionItemsTable.createdAt, thirtyDaysAgo)
      )
    )
    .orderBy(desc(actionItemsTable.createdAt))
    .limit(50);

  const plan = await generateActionPlan(
    goals,
    pending.map((p) => ({
      action: p.action,
      intentType: p.intentType,
      sourceTitle: p.articleTitle || "(no source)",
    }))
  );

  const weekStart = startOfWeek();
  const [existing] = await db
    .select({ id: actionPlansTable.id })
    .from(actionPlansTable)
    .where(and(eq(actionPlansTable.userId, user.id), eq(actionPlansTable.weekStart, weekStart)));

  let saved;
  if (existing) {
    [saved] = await db
      .update(actionPlansTable)
      .set({ planJson: plan, userGoals: goals, generatedAt: new Date() })
      .where(eq(actionPlansTable.id, existing.id))
      .returning();
  } else {
    [saved] = await db
      .insert(actionPlansTable)
      .values({ userId: user.id, weekStart, planJson: plan, userGoals: goals })
      .returning();
  }

  res.json(serializePlan(saved));
});

/** Flatten DB row { planJson: { topActions, insight } } into the shape the UI expects. */
function serializePlan(row: typeof actionPlansTable.$inferSelect | undefined) {
  if (!row) return null;
  const plan = (row.planJson ?? {}) as { topActions?: unknown; insight?: string };
  return {
    id: row.id,
    weekStart: row.weekStart,
    generatedAt: row.generatedAt,
    topActions: Array.isArray(plan.topActions) ? plan.topActions : [],
    insight: typeof plan.insight === "string" ? plan.insight : "",
  };
}

/**
 * GET /action-plan/current — most recent plan for this week (auto-generates if none).
 */
router.get("/action-plan/current", requireAuth, async (req, res) => {
  const user = (req as AuthRequest).user;
  const weekStart = startOfWeek();

  const [existing] = await db
    .select()
    .from(actionPlansTable)
    .where(and(eq(actionPlansTable.userId, user.id), eq(actionPlansTable.weekStart, weekStart)))
    .orderBy(desc(actionPlansTable.generatedAt))
    .limit(1);

  if (existing) {
    res.json(serializePlan(existing));
    return;
  }

  // Check if user has any saved articles before auto-generating
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(savedArticlesTable)
    .where(eq(savedArticlesTable.userId, user.id));

  if (!count) {
    res.json(null);
    return;
  }

  // Auto-generate inline (small number of actions, <2s usually)
  const [u] = await db.select({ goals: usersTable.goals }).from(usersTable).where(eq(usersTable.id, user.id));
  const goals = u?.goals ?? "";

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const pending = await db
    .select({
      action: actionItemsTable.action,
      intentType: actionItemsTable.intentType,
      articleTitle: savedArticlesTable.title,
    })
    .from(actionItemsTable)
    .leftJoin(savedArticlesTable, eq(actionItemsTable.articleId, savedArticlesTable.id))
    .where(
      and(
        eq(actionItemsTable.userId, user.id),
        eq(actionItemsTable.status, "pending"),
        gte(actionItemsTable.createdAt, thirtyDaysAgo)
      )
    )
    .limit(50);

  const plan = await generateActionPlan(
    goals,
    pending.map((p) => ({
      action: p.action,
      intentType: p.intentType,
      sourceTitle: p.articleTitle || "(no source)",
    }))
  );

  const [saved] = await db
    .insert(actionPlansTable)
    .values({ userId: user.id, weekStart, planJson: plan, userGoals: goals })
    .returning();

  res.json(serializePlan(saved));
});

/**
 * PATCH /action-items/:id — mark complete or snooze.
 * Body: { status: "completed" | "snoozed" | "pending" }
 */
router.patch("/action-items/:id", requireAuth, async (req, res) => {
  const user = (req as AuthRequest).user;
  const id = parseInt(String(req.params.id), 10);
  if (!id) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const status = String(req.body?.status || "pending");
  if (!["pending", "completed", "snoozed"].includes(status)) {
    res.status(400).json({ error: "Invalid status" });
    return;
  }

  const updates: Record<string, any> = { status };
  if (status === "completed") {
    updates.completedAt = new Date();
    updates.snoozedUntil = null;
  } else if (status === "snoozed") {
    updates.snoozedUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    updates.completedAt = null;
  } else {
    updates.completedAt = null;
    updates.snoozedUntil = null;
  }

  const [updated] = await db
    .update(actionItemsTable)
    .set(updates)
    .where(and(eq(actionItemsTable.id, id), eq(actionItemsTable.userId, user.id)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(updated);
});

/**
 * GET /action-items/pending
 * Returns pending items grouped by intent_type. Snoozed items reappear after their date.
 * Also returns the AI insight (saves vs completions in last 30d).
 */
router.get("/action-items/pending", requireAuth, async (req, res) => {
  const user = (req as AuthRequest).user;
  const now = new Date();

  const items = await db
    .select({
      id: actionItemsTable.id,
      action: actionItemsTable.action,
      intentType: actionItemsTable.intentType,
      status: actionItemsTable.status,
      createdAt: actionItemsTable.createdAt,
      snoozedUntil: actionItemsTable.snoozedUntil,
      articleId: actionItemsTable.articleId,
      articleTitle: savedArticlesTable.title,
      articleUrl: savedArticlesTable.url,
    })
    .from(actionItemsTable)
    .leftJoin(savedArticlesTable, eq(actionItemsTable.articleId, savedArticlesTable.id))
    .where(
      and(
        eq(actionItemsTable.userId, user.id),
        or(
          eq(actionItemsTable.status, "pending"),
          and(eq(actionItemsTable.status, "snoozed"), lte(actionItemsTable.snoozedUntil, now))
        )
      )
    )
    .orderBy(desc(actionItemsTable.createdAt));

  const groups: Record<string, typeof items> = {};
  for (const it of items) {
    const key = it.intentType || "general";
    (groups[key] ||= []).push(it);
  }

  // Saves vs completions insight
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [{ saved30 }] = await db
    .select({ saved30: sql<number>`count(*)::int` })
    .from(savedArticlesTable)
    .where(and(eq(savedArticlesTable.userId, user.id), gte(savedArticlesTable.createdAt, thirtyDaysAgo)));
  const [{ completed30 }] = await db
    .select({ completed30: sql<number>`count(*)::int` })
    .from(actionItemsTable)
    .where(
      and(
        eq(actionItemsTable.userId, user.id),
        eq(actionItemsTable.status, "completed"),
        gte(actionItemsTable.completedAt!, thirtyDaysAgo)
      )
    );

  const pendingCount = items.length;
  res.json({
    groups,
    stats: {
      saved: saved30 ?? 0,
      completed: completed30 ?? 0,
      pending: pendingCount,
    },
  });
});

export default router;
