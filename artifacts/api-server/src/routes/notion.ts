import { Router } from "express";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { db, savedArticlesTable, highlightsTable, articleNotesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { pgTable, serial, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const router = Router();

const integrationsTable = pgTable("integrations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  provider: text("provider").notNull(),
  accessToken: text("access_token"),
  workspaceId: text("workspace_id"),
  workspaceName: text("workspace_name"),
  settings: jsonb("settings"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

const articleSyncsTable = pgTable("article_syncs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  articleId: integer("article_id").notNull(),
  provider: text("provider").notNull(),
  externalId: text("external_id"),
  syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
});

const NOTION_CLIENT_ID = process.env.NOTION_CLIENT_ID;
const NOTION_CLIENT_SECRET = process.env.NOTION_CLIENT_SECRET;
const NOTION_REDIRECT_URI = process.env.NOTION_REDIRECT_URI || `${process.env.APP_URL || ""}/api/integrations/notion/callback`;

// GET /integrations/notion/connect — get OAuth URL
router.get("/integrations/notion/connect", requireAuth, (req, res): void => {
  if (!NOTION_CLIENT_ID) { res.status(503).json({ error: "Notion integration not configured. Add NOTION_CLIENT_ID and NOTION_CLIENT_SECRET." }); return; }
  const authUrl = `https://api.notion.com/v1/oauth/authorize?client_id=${NOTION_CLIENT_ID}&response_type=code&owner=user&redirect_uri=${encodeURIComponent(NOTION_REDIRECT_URI)}`;
  res.json({ authUrl });
});

// GET /integrations/notion/callback — OAuth callback
router.get("/integrations/notion/callback", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const code = String(req.query.code ?? "");
  if (!code || !NOTION_CLIENT_ID || !NOTION_CLIENT_SECRET) {
    res.status(400).json({ error: "OAuth code or config missing" }); return;
  }

  const tokenRes = await fetch("https://api.notion.com/v1/oauth/token", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${Buffer.from(`${NOTION_CLIENT_ID}:${NOTION_CLIENT_SECRET}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ grant_type: "authorization_code", code, redirect_uri: NOTION_REDIRECT_URI }),
  });

  const tokenData = await tokenRes.json() as any;
  if (!tokenRes.ok) { res.status(400).json({ error: tokenData.error_description || "OAuth failed" }); return; }

  await db.execute(sql`
    INSERT INTO integrations (user_id, provider, access_token, workspace_id, workspace_name, settings)
    VALUES (${user.id}, 'notion', ${tokenData.access_token}, ${tokenData.workspace_id}, ${tokenData.workspace_name}, '{}')
    ON CONFLICT (user_id, provider) DO UPDATE SET
      access_token = EXCLUDED.access_token,
      workspace_id = EXCLUDED.workspace_id,
      workspace_name = EXCLUDED.workspace_name
  `);

  res.redirect("/#notion-connected");
});

// GET /integrations/notion/status
router.get("/integrations/notion/status", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const rows = await db.execute(sql`SELECT * FROM integrations WHERE user_id = ${user.id} AND provider = 'notion'`);
  const integration = rows.rows[0] as any;
  if (!integration) { res.json({ connected: false }); return; }

  // Count synced articles
  const [syncCount] = await db.select({ count: sql<number>`count(*)::int` })
    .from(articleSyncsTable).where(and(eq(articleSyncsTable.userId, user.id), eq(articleSyncsTable.provider, "notion")));

  res.json({
    connected: true,
    workspaceName: integration.workspace_name,
    selectedDatabaseId: (integration.settings as any)?.selectedDatabaseId ?? null,
    autoSync: (integration.settings as any)?.autoSync ?? false,
    syncedCount: syncCount?.count ?? 0,
  });
});

// GET /integrations/notion/databases
router.get("/integrations/notion/databases", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const rows = await db.execute(sql`SELECT access_token FROM integrations WHERE user_id = ${user.id} AND provider = 'notion'`);
  const integration = rows.rows[0] as any;
  if (!integration?.access_token) { res.status(400).json({ error: "Not connected to Notion" }); return; }

  const dbRes = await fetch("https://api.notion.com/v1/search", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${integration.access_token}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ filter: { value: "database", property: "object" } }),
  });

  const dbData = await dbRes.json() as any;
  const databases = (dbData.results ?? []).map((d: any) => ({
    id: d.id,
    title: d.title?.[0]?.text?.content ?? "Untitled",
  }));

  res.json({ databases });
});

// PATCH /integrations/notion/settings
router.patch("/integrations/notion/settings", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const { selectedDatabaseId, autoSync } = req.body ?? {};
  await db.execute(sql`
    UPDATE integrations SET settings = jsonb_build_object('selectedDatabaseId', ${selectedDatabaseId}, 'autoSync', ${autoSync})
    WHERE user_id = ${user.id} AND provider = 'notion'
  `);
  res.json({ success: true });
});

// POST /integrations/notion/sync/:articleId
router.post("/integrations/notion/sync/:articleId", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const articleId = Number(req.params.articleId);

  const rows = await db.execute(sql`SELECT * FROM integrations WHERE user_id = ${user.id} AND provider = 'notion'`);
  const integration = rows.rows[0] as any;
  if (!integration?.access_token) { res.status(400).json({ error: "Not connected to Notion" }); return; }

  const databaseId = (integration.settings as any)?.selectedDatabaseId;
  if (!databaseId) { res.status(400).json({ error: "Select a Notion database in settings first" }); return; }

  const [article] = await db.select().from(savedArticlesTable)
    .where(and(eq(savedArticlesTable.id, articleId), eq(savedArticlesTable.userId, user.id)));
  if (!article) { res.status(404).json({ error: "Article not found" }); return; }

  const [noteRow] = await db.select().from(articleNotesTable)
    .where(and(eq(articleNotesTable.articleId, articleId), eq(articleNotesTable.userId, user.id)));

  const highlights = await db.select().from(highlightsTable)
    .where(and(eq(highlightsTable.articleId, articleId), eq(highlightsTable.userId, user.id)));

  const bullets = (article.bullets as string[]) ?? [];

  const children: any[] = [
    { object: "block", type: "callout", callout: {
      rich_text: [{ type: "text", text: { content: article.verdict ?? "" } }],
      icon: { emoji: "🧠" },
    }},
    { object: "block", type: "heading_2", heading_2: { rich_text: [{ type: "text", text: { content: "Key Takeaways" } }] }},
    ...bullets.map(b => ({ object: "block", type: "numbered_list_item", numbered_list_item: { rich_text: [{ type: "text", text: { content: b } }] } })),
  ];

  if (noteRow?.noteText) {
    children.push(
      { object: "block", type: "heading_2", heading_2: { rich_text: [{ type: "text", text: { content: "My Notes" } }] }},
      { object: "block", type: "paragraph", paragraph: { rich_text: [{ type: "text", text: { content: noteRow.noteText } }] }},
    );
  }

  if (highlights.length > 0) {
    children.push({ object: "block", type: "heading_2", heading_2: { rich_text: [{ type: "text", text: { content: "Highlights" } }] }});
    highlights.forEach(h => children.push({
      object: "block", type: "bulleted_list_item",
      bulleted_list_item: { rich_text: [{ type: "text", text: { content: h.bulletText } }] },
    }));
  }

  const pageRes = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${integration.access_token}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      parent: { database_id: databaseId },
      properties: {
        Name: { title: [{ type: "text", text: { content: article.title ?? "Untitled" } }] },
        URL: { url: article.url ?? null },
        "Recall Score": { number: article.recallScore ?? null },
        "Date Saved": { date: { start: article.createdAt.toISOString().split("T")[0] } },
      },
      children: children.slice(0, 100),
    }),
  });

  const pageData = await pageRes.json() as any;
  if (!pageRes.ok) { res.status(400).json({ error: pageData.message || "Failed to create Notion page" }); return; }

  await db.execute(sql`
    INSERT INTO article_syncs (user_id, article_id, provider, external_id, synced_at)
    VALUES (${user.id}, ${articleId}, 'notion', ${pageData.id}, now())
    ON CONFLICT (article_id, provider) DO UPDATE SET external_id = EXCLUDED.external_id, synced_at = now()
  `);

  res.json({ success: true, notionPageId: pageData.id, notionUrl: pageData.url });
});

// POST /integrations/notion/sync-all — sync all unsynced articles
router.post("/integrations/notion/sync-all", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;

  const rows = await db.execute(sql`SELECT * FROM integrations WHERE user_id = ${user.id} AND provider = 'notion'`);
  const integration = rows.rows[0] as any;
  if (!integration?.access_token) { res.status(400).json({ error: "Not connected to Notion" }); return; }
  const databaseId = (integration.settings as any)?.selectedDatabaseId;
  if (!databaseId) { res.status(400).json({ error: "Select a Notion database first" }); return; }

  const synced = await db.select({ articleId: articleSyncsTable.articleId })
    .from(articleSyncsTable).where(and(eq(articleSyncsTable.userId, user.id), eq(articleSyncsTable.provider, "notion")));
  const syncedIds = new Set(synced.map(s => s.articleId));

  const articles = await db.select().from(savedArticlesTable).where(eq(savedArticlesTable.userId, user.id));
  const unsynced = articles.filter(a => !syncedIds.has(a.id));

  let count = 0;
  for (const article of unsynced.slice(0, 50)) {
    try {
      const pageRes = await fetch("https://api.notion.com/v1/pages", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${integration.access_token}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          parent: { database_id: databaseId },
          properties: {
            Name: { title: [{ type: "text", text: { content: article.title ?? "Untitled" } }] },
            URL: { url: article.url ?? null },
            "Recall Score": { number: article.recallScore ?? null },
            "Date Saved": { date: { start: article.createdAt.toISOString().split("T")[0] } },
          },
          children: [{ object: "block", type: "callout", callout: {
            rich_text: [{ type: "text", text: { content: article.verdict ?? "" } }],
            icon: { emoji: "🧠" },
          }}],
        }),
      });
      const pageData = await pageRes.json() as any;
      if (pageRes.ok) {
        await db.execute(sql`
          INSERT INTO article_syncs (user_id, article_id, provider, external_id, synced_at)
          VALUES (${user.id}, ${article.id}, 'notion', ${pageData.id}, now())
          ON CONFLICT (article_id, provider) DO UPDATE SET external_id = EXCLUDED.external_id, synced_at = now()
        `);
        count++;
      }
    } catch {}
  }

  res.json({ synced: count, total: unsynced.length });
});

// DELETE /integrations/notion — disconnect
router.delete("/integrations/notion", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  await db.execute(sql`DELETE FROM integrations WHERE user_id = ${user.id} AND provider = 'notion'`);
  res.json({ success: true });
});

// GET /integrations/notion/synced-ids — check which articles are synced
router.get("/integrations/notion/synced-ids", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const synced = await db.select({ articleId: articleSyncsTable.articleId, externalId: articleSyncsTable.externalId })
    .from(articleSyncsTable).where(and(eq(articleSyncsTable.userId, user.id), eq(articleSyncsTable.provider, "notion")));
  res.json({ synced });
});

export default router;
