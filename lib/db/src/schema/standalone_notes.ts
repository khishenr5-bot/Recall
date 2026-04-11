import { pgTable, text, serial, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const standaloneNotesTable = pgTable("standalone_notes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull().default("Untitled Note"),
  content: text("content").notNull().default(""),
  linkedArticleIds: jsonb("linked_article_ids").$type<number[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertStandaloneNoteSchema = createInsertSchema(standaloneNotesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertStandaloneNote = z.infer<typeof insertStandaloneNoteSchema>;
export type StandaloneNote = typeof standaloneNotesTable.$inferSelect;
