import { pgTable, text, serial, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const canvasSessionsTable = pgTable("canvas_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull().default("Untitled Strategy"),
  problem: text("problem").notNull(),
  messages: jsonb("messages").$type<{ role: "user" | "assistant"; content: string }[]>().notNull().default([]),
  linkedArticleIds: jsonb("linked_article_ids").$type<number[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCanvasSessionSchema = createInsertSchema(canvasSessionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCanvasSession = z.infer<typeof insertCanvasSessionSchema>;
export type CanvasSession = typeof canvasSessionsTable.$inferSelect;
