import { Router } from "express";
import { db, savedArticlesTable } from "@workspace/db";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { verifyToken } from "../lib/auth";

const router = Router();

function authFromQuery(req: any): number | null {
  const token = (req.query.token as string) || (req.query.api_key as string) || "";
  if (!token) return null;
  const payload = verifyToken(token);
  return payload?.userId ?? null;
}

router.get("/widget/quick-save", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const userId = authFromQuery(req);
  const appUrl = `${req.protocol}://${req.get("host")}/?source=widget`;
  if (!userId) {
    return res.json({
      authRequired: true,
      template: "generic-template",
      data: { recentCount: 0, appUrl, message: "Sign in to use this widget" },
    });
  }
  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const rows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(savedArticlesTable)
      .where(and(eq(savedArticlesTable.userId, userId), gte(savedArticlesTable.createdAt, weekAgo)));
    return res.json({
      template: "generic-template",
      data: { recentCount: rows[0]?.count ?? 0, appUrl },
    });
  } catch {
    return res.json({ template: "generic-template", data: { recentCount: 0, appUrl } });
  }
});

router.get("/widget/digest", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const userId = authFromQuery(req);
  const appUrl = `${req.protocol}://${req.get("host")}/saved?source=widget`;
  if (!userId) {
    return res.json({
      authRequired: true,
      template: "generic-template",
      data: { items: [], appUrl, message: "Sign in to see your digest" },
    });
  }
  try {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const rows = await db
      .select({
        id: savedArticlesTable.id,
        title: savedArticlesTable.title,
        verdict: savedArticlesTable.verdict,
        url: savedArticlesTable.url,
      })
      .from(savedArticlesTable)
      .where(and(eq(savedArticlesTable.userId, userId), gte(savedArticlesTable.createdAt, dayAgo)))
      .orderBy(desc(savedArticlesTable.createdAt))
      .limit(3);
    return res.json({
      template: "generic-template",
      data: {
        appUrl,
        items: rows.map((r) => ({
          title: r.title || "Untitled",
          verdict: (r.verdict || "").slice(0, 140),
          url: r.url,
        })),
      },
    });
  } catch {
    return res.json({ template: "generic-template", data: { items: [], appUrl } });
  }
});

export default router;
