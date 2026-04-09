import { Router } from "express";
import bcrypt from "bcryptjs";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { db, usersTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";
import { signToken, requireAuth, type AuthRequest } from "../lib/auth";
import {
  RegisterBody,
  LoginBody,
  UpdateProfileBody,
} from "@workspace/api-zod";

const router = Router();

// --- Google OAuth (only initialise when keys are present) ---
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REPLIT_DEV_DOMAIN = process.env.REPLIT_DEV_DOMAIN;

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  router.get("/auth/google", (_req, res) => {
    const frontendBase = REPLIT_DEV_DOMAIN
      ? `https://${REPLIT_DEV_DOMAIN}`
      : "http://localhost:24816";
    res.redirect(`${frontendBase}/login?error=google_not_configured`);
  });
  router.get("/auth/google/callback", (_req, res) => {
    const frontendBase = REPLIT_DEV_DOMAIN
      ? `https://${REPLIT_DEV_DOMAIN}`
      : "http://localhost:24816";
    res.redirect(`${frontendBase}/login?error=google_not_configured`);
  });
}

if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
  const callbackURL = REPLIT_DEV_DOMAIN
    ? `https://${REPLIT_DEV_DOMAIN}/api/auth/google/callback`
    : "http://localhost:8080/api/auth/google/callback";

  passport.use(
    new GoogleStrategy(
      { clientID: GOOGLE_CLIENT_ID, clientSecret: GOOGLE_CLIENT_SECRET, callbackURL, scope: ["profile", "email"] },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          const avatarUrl = profile.photos?.[0]?.value ?? null;
          const displayName = profile.displayName;
          if (!email) return done(new Error("No email from Google"), undefined);

          const [existing] = await db
            .select()
            .from(usersTable)
            .where(or(eq(usersTable.googleId, profile.id), eq(usersTable.email, email)));

          if (existing) {
            const updates: Partial<typeof usersTable.$inferInsert> = {};
            if (!existing.googleId) updates.googleId = profile.id;
            if (!existing.avatarUrl && avatarUrl) updates.avatarUrl = avatarUrl;
            if (Object.keys(updates).length > 0) {
              await db.update(usersTable).set(updates).where(eq(usersTable.id, existing.id));
            }
            return done(null, { ...existing, ...updates });
          }

          const [created] = await db
            .insert(usersTable)
            .values({ email, passwordHash: "", googleId: profile.id, avatarUrl, username: displayName })
            .returning();
          return done(null, created);
        } catch (err) {
          return done(err as Error, undefined);
        }
      }
    )
  );

  router.use(passport.initialize());

  router.get("/auth/google", passport.authenticate("google", { session: false, scope: ["profile", "email"] }));

  router.get(
    "/auth/google/callback",
    passport.authenticate("google", { session: false, failureRedirect: "/login?error=google_failed" }),
    (req, res) => {
      const user = req.user as typeof usersTable.$inferSelect;
      const token = signToken(user.id);
      const frontendBase = REPLIT_DEV_DOMAIN
        ? `https://${REPLIT_DEV_DOMAIN}`
        : "http://localhost:24816";
      res.redirect(`${frontendBase}/?token=${token}`);
    }
  );
}

// --- Standard auth ---
router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, password, username } = parsed.data;

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing) {
    res.status(409).json({ error: "Email already registered" });
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
  res.status(201).json({ token, user });
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

  if (!user.passwordHash) {
    res.status(401).json({ error: "This account uses Google sign-in. Please continue with Google." });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const token = signToken(user.id);
  res.json({ token, user });
});

router.post("/auth/logout", requireAuth, async (_req, res): Promise<void> => {
  res.json({ success: true, message: "Logged out" });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  res.json(user);
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

  res.json(updated);
});

export default router;
