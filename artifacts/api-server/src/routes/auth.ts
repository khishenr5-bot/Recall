import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { signToken, requireAuth, type AuthRequest } from "../lib/auth";
import {
  RegisterBody,
  LoginBody,
  UpdateProfileBody,
} from "@workspace/api-zod";

const router = Router();

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, password, username } = parsed.data;

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing) {
    res.status(400).json({ error: "Email already registered" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db.insert(usersTable).values({
    email,
    passwordHash,
    username: username ?? null,
    plan: "free",
    monthlySavesCount: 0,
    savesLimit: 50,
    preferredLanguage: "en",
    onboardingCompleted: false,
  }).returning();

  if (!user) {
    res.status(500).json({ error: "Failed to create user" });
    return;
  }

  const token = signToken(user.id);
  res.status(201).json({
    token,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      plan: user.plan,
      monthlySavesCount: user.monthlySavesCount,
      savesLimit: user.savesLimit,
      preferredLanguage: user.preferredLanguage,
      onboardingCompleted: user.onboardingCompleted,
      createdAt: user.createdAt,
    },
  });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, password } = parsed.data;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));

  if (!user) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const token = signToken(user.id);
  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      plan: user.plan,
      monthlySavesCount: user.monthlySavesCount,
      savesLimit: user.savesLimit,
      preferredLanguage: user.preferredLanguage,
      onboardingCompleted: user.onboardingCompleted,
      createdAt: user.createdAt,
    },
  });
});

router.post("/auth/logout", requireAuth, async (_req, res): Promise<void> => {
  res.json({ success: true, message: "Logged out" });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  res.json({
    id: user.id,
    email: user.email,
    username: user.username,
    plan: user.plan,
    monthlySavesCount: user.monthlySavesCount,
    savesLimit: user.savesLimit,
    preferredLanguage: user.preferredLanguage,
    onboardingCompleted: user.onboardingCompleted,
    createdAt: user.createdAt,
  });
});

router.patch("/auth/profile", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const parsed = UpdateProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (parsed.data.username !== undefined) updates.username = parsed.data.username;
  if (parsed.data.preferredLanguage !== undefined) updates.preferredLanguage = parsed.data.preferredLanguage ?? "en";
  if (parsed.data.onboardingCompleted !== undefined) updates.onboardingCompleted = parsed.data.onboardingCompleted ?? false;

  const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, user.id)).returning();
  if (!updated) {
    res.status(500).json({ error: "Update failed" });
    return;
  }

  res.json({
    id: updated.id,
    email: updated.email,
    username: updated.username,
    plan: updated.plan,
    monthlySavesCount: updated.monthlySavesCount,
    savesLimit: updated.savesLimit,
    preferredLanguage: updated.preferredLanguage,
    onboardingCompleted: updated.onboardingCompleted,
    createdAt: updated.createdAt,
  });
});

export default router;
