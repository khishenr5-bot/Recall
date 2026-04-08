import { Router } from "express";
import { db, collectionsTable, savedArticlesTable } from "@workspace/db";
import { eq, and, count } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { CreateCollectionBody, DeleteCollectionParams } from "@workspace/api-zod";

const router = Router();

router.get("/collections", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;

  const collections = await db.select().from(collectionsTable)
    .where(eq(collectionsTable.userId, user.id));

  const withCounts = await Promise.all(
    collections.map(async (col) => {
      const [result] = await db.select({ count: count() })
        .from(savedArticlesTable)
        .where(and(
          eq(savedArticlesTable.collectionId, col.id),
          eq(savedArticlesTable.userId, user.id)
        ));
      return {
        id: col.id,
        userId: col.userId,
        name: col.name,
        color: col.color,
        articleCount: result?.count ?? 0,
        createdAt: col.createdAt.toISOString(),
      };
    })
  );

  res.json(withCounts);
});

router.post("/collections", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const parsed = CreateCollectionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [collection] = await db.insert(collectionsTable).values({
    userId: user.id,
    name: parsed.data.name,
    color: parsed.data.color,
  }).returning();

  if (!collection) {
    res.status(500).json({ error: "Failed to create collection" });
    return;
  }

  res.status(201).json({
    id: collection.id,
    userId: collection.userId,
    name: collection.name,
    color: collection.color,
    articleCount: 0,
    createdAt: collection.createdAt.toISOString(),
  });
});

router.delete("/collections/:id", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteCollectionParams.safeParse({ id: parseInt(rawId ?? "0", 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db.delete(collectionsTable)
    .where(and(eq(collectionsTable.id, params.data.id), eq(collectionsTable.userId, user.id)))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Collection not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
