import { Router } from "express";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { db, savedArticlesTable, highlightsTable, collectionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/export/json", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;

  const [articles, highlights, collections] = await Promise.all([
    db.select().from(savedArticlesTable).where(eq(savedArticlesTable.userId, user.id)),
    db.select().from(highlightsTable).where(eq(highlightsTable.userId, user.id)),
    db.select().from(collectionsTable).where(eq(collectionsTable.userId, user.id)),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    user: { email: user.email, username: user.username, plan: user.plan },
    articles: articles.map(a => ({
      id: a.id, url: a.url, title: a.title,
      verdict: a.verdict, bullets: a.bullets,
      articleText: a.articleText, recallScore: a.recallScore,
      credibilityScore: a.credibilityScore, credibilityVerdict: a.credibilityVerdict,
      language: a.language, sourceType: a.sourceType,
      collectionId: a.collectionId, createdAt: a.createdAt,
    })),
    highlights: highlights.map(h => ({
      id: h.id, bulletText: h.bulletText, note: h.note,
      articleId: h.articleId, createdAt: h.createdAt,
    })),
    collections: collections.map(c => ({
      id: c.id, name: c.name, color: c.color, createdAt: c.createdAt,
    })),
  };

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="recall-export-${Date.now()}.json"`);
  res.json(payload);
});

router.get("/export/markdown", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const articles = await db.select().from(savedArticlesTable).where(eq(savedArticlesTable.userId, user.id));

  // Build a single combined markdown file
  const lines: string[] = [
    `# Recall.ai Export — ${user.email}`,
    `> Exported on ${new Date().toLocaleDateString()}`,
    "",
  ];

  for (const a of articles) {
    const safeTitle = a.title.replace(/[^\w\s-]/g, "").trim() || "Untitled";
    lines.push(`## ${safeTitle}`);
    if (a.url) lines.push(`**Source:** ${a.url}`);
    lines.push(`**Recall Score:** ${a.recallScore}/10 | **Trust Score:** ${a.credibilityScore}/10`);
    lines.push(`**Date:** ${new Date(a.createdAt).toLocaleDateString()}`);
    lines.push("");
    if (a.verdict) { lines.push(`### Verdict`); lines.push(a.verdict); lines.push(""); }
    if (Array.isArray(a.bullets) && a.bullets.length > 0) {
      lines.push("### Key Takeaways");
      (a.bullets as string[]).forEach((b, i) => lines.push(`${i + 1}. ${b}`));
      lines.push("");
    }
    lines.push("---");
    lines.push("");
  }

  const content = lines.join("\n");
  res.setHeader("Content-Type", "text/markdown");
  res.setHeader("Content-Disposition", `attachment; filename="recall-library-${Date.now()}.md"`);
  res.send(content);
});

router.get("/export/csv", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const articles = await db.select().from(savedArticlesTable).where(eq(savedArticlesTable.userId, user.id));

  const escape = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;

  const headers = ["id", "title", "url", "verdict", "recall_score", "trust_score", "language", "source_type", "created_at"];
  const rows = articles.map(a => [
    a.id, escape(a.title), escape(a.url ?? ""), escape(a.verdict ?? ""),
    a.recallScore, a.credibilityScore, a.language ?? "", a.sourceType ?? "",
    new Date(a.createdAt).toISOString(),
  ].join(","));

  const csv = [headers.join(","), ...rows].join("\n");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="recall-articles-${Date.now()}.csv"`);
  res.send(csv);
});

export default router;
