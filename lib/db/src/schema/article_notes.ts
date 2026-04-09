import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { savedArticlesTable } from "./saved_articles";

export const articleNotesTable = pgTable("article_notes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  articleId: integer("article_id").notNull().references(() => savedArticlesTable.id, { onDelete: "cascade" }),
  noteText: text("note_text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertArticleNoteSchema = createInsertSchema(articleNotesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertArticleNote = z.infer<typeof insertArticleNoteSchema>;
export type ArticleNote = typeof articleNotesTable.$inferSelect;
