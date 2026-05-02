import { Router } from "express";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { db } from "@workspace/db";
import { sql, eq, and } from "drizzle-orm";
import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { generateText } from "../lib/ai";

const router = Router();

// Inline table definitions (schema not yet in lib/db)
const teamsTable = pgTable("teams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  ownerId: integer("owner_id").notNull(),
  inviteCode: text("invite_code").notNull().unique(),
  plan: text("plan").notNull().default("free"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

const teamMembersTable = pgTable("team_members", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull(),
  userId: integer("user_id").notNull(),
  role: text("role").notNull().default("member"),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
});

const teamLibrariesTable = pgTable("team_libraries", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull(),
  articleId: integer("article_id").notNull(),
  sharedByUserId: integer("shared_by_user_id").notNull(),
  sharedAt: timestamp("shared_at", { withTimezone: true }).notNull().defaultNow(),
});

function randomCode() {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

// POST /teams — create
router.post("/teams", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const name = String(req.body?.name ?? "").trim();
  if (!name) { res.status(400).json({ error: "Team name required" }); return; }

  const inviteCode = randomCode();
  const [team] = await db.insert(teamsTable).values({ name, ownerId: user.id, inviteCode }).returning();
  // Owner is also a member
  await db.insert(teamMembersTable).values({ teamId: team.id, userId: user.id, role: "admin" });
  res.status(201).json({ team });
});

// GET /teams/my
router.get("/teams/my", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const memberships = await db.select({ teamId: teamMembersTable.teamId, role: teamMembersTable.role })
    .from(teamMembersTable).where(eq(teamMembersTable.userId, user.id));
  const teamIds = memberships.map(m => m.teamId);
  if (teamIds.length === 0) { res.json({ teams: [] }); return; }

  const teams = await Promise.all(teamIds.map(async (id) => {
    const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, id));
    const [memberCount] = await db.select({ count: sql<number>`count(*)::int` })
      .from(teamMembersTable).where(eq(teamMembersTable.teamId, id));
    const membership = memberships.find(m => m.teamId === id);
    return { ...team, memberCount: memberCount?.count ?? 0, myRole: membership?.role };
  }));

  res.json({ teams });
});

// POST /teams/:id/invite — regenerate invite link
router.post("/teams/:id/invite", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const teamId = Number(req.params.id);
  const [member] = await db.select().from(teamMembersTable)
    .where(and(eq(teamMembersTable.teamId, teamId), eq(teamMembersTable.userId, user.id)));
  if (!member || member.role !== "admin") { res.status(403).json({ error: "Admin only" }); return; }
  const newCode = randomCode();
  await db.update(teamsTable).set({ inviteCode: newCode }).where(eq(teamsTable.id, teamId));
  res.json({ inviteCode: newCode });
});

// POST /teams/join/:code
router.post("/teams/join/:code", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const code = (req.params.code as string).toUpperCase();
  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.inviteCode, code));
  if (!team) { res.status(404).json({ error: "Invalid invite code" }); return; }

  const existing = await db.select().from(teamMembersTable)
    .where(and(eq(teamMembersTable.teamId, team.id), eq(teamMembersTable.userId, user.id)));
  if (existing.length > 0) { res.json({ team, message: "Already a member" }); return; }

  await db.insert(teamMembersTable).values({ teamId: team.id, userId: user.id, role: "member" });
  res.json({ team });
});

// POST /teams/:id/share/:articleId
router.post("/teams/:id/share/:articleId", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const teamId = Number(req.params.id);
  const articleId = Number(req.params.articleId);

  const [member] = await db.select().from(teamMembersTable)
    .where(and(eq(teamMembersTable.teamId, teamId), eq(teamMembersTable.userId, user.id)));
  if (!member) { res.status(403).json({ error: "Not a team member" }); return; }

  await db.insert(teamLibrariesTable).values({ teamId, articleId, sharedByUserId: user.id });
  res.json({ success: true });
});

// GET /teams/:id/library
router.get("/teams/:id/library", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const teamId = Number(req.params.id);

  const [member] = await db.select().from(teamMembersTable)
    .where(and(eq(teamMembersTable.teamId, teamId), eq(teamMembersTable.userId, user.id)));
  if (!member) { res.status(403).json({ error: "Not a team member" }); return; }

  const rows = await db.execute(sql`
    SELECT tl.id as share_id, tl.shared_at, tl.shared_by_user_id,
           u.username as shared_by_username, u.email as shared_by_email,
           sa.id, sa.title, sa.url, sa.verdict, sa.bullets,
           sa.recall_score, sa.credibility_score, sa.source_type, sa.created_at
    FROM team_libraries tl
    JOIN saved_articles sa ON tl.article_id = sa.id
    JOIN users u ON tl.shared_by_user_id = u.id
    WHERE tl.team_id = ${teamId}
    ORDER BY tl.shared_at DESC
  `);

  res.json({ articles: rows.rows });
});

// POST /teams/:id/ask — AI search across team library
router.post("/teams/:id/ask", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const teamId = Number(req.params.id);
  const question = String(req.body?.question ?? "").trim();
  if (!question) { res.status(400).json({ error: "question required" }); return; }

  const [member] = await db.select().from(teamMembersTable)
    .where(and(eq(teamMembersTable.teamId, teamId), eq(teamMembersTable.userId, user.id)));
  if (!member) { res.status(403).json({ error: "Not a team member" }); return; }

  const rows = await db.execute(sql`
    SELECT sa.title, sa.verdict, sa.bullets
    FROM team_libraries tl JOIN saved_articles sa ON tl.article_id = sa.id
    WHERE tl.team_id = ${teamId}
  `);

  const context = (rows.rows as any[]).map(r =>
    `Title: ${r.title}\nVerdict: ${r.verdict}\nTakeaways: ${Array.isArray(r.bullets) ? r.bullets.join("; ") : ""}`
  ).join("\n\n---\n\n").slice(0, 40000);

  const answer = await generateText(
    `You are a research assistant for a team. Based on the team's shared articles, answer the question.\n\nArticles:\n${context}\n\nQuestion: ${question}\n\nAnswer concisely in 2-4 sentences.`
  );

  res.json({ answer });
});

// DELETE /teams/:id — disband (owner only)
router.delete("/teams/:id", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const teamId = Number(req.params.id);
  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, teamId));
  if (!team || team.ownerId !== user.id) { res.status(403).json({ error: "Owner only" }); return; }
  await db.delete(teamsTable).where(eq(teamsTable.id, teamId));
  res.json({ success: true });
});

export default router;
