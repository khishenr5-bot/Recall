import { pgTable, text, serial, timestamp, integer, boolean, jsonb, real, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { collectionsTable } from "./collections";

export const savedArticlesTable = pgTable("saved_articles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  url: text("url"),
  title: text("title").notNull(),
  verdict: text("verdict").notNull(),
  bullets: jsonb("bullets").notNull().default([]),
  articleText: text("article_text"),
  language: text("language").notNull().default("en"),
  recallScore: real("recall_score").notNull().default(5),
  credibilityScore: real("credibility_score").notNull().default(5),
  credibilityVerdict: text("credibility_verdict"),
  collectionId: integer("collection_id").references(() => collectionsTable.id, { onDelete: "set null" }),
  shareToken: text("share_token").unique(),
  isPublic: boolean("is_public").notNull().default(false),
  lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
  reviewCount: integer("review_count").notNull().default(0),
  nextReviewAt: timestamp("next_review_at", { withTimezone: true }),
  sourceType: text("source_type").notNull().default("url"),
  status: text("status").notNull().default("unread"),
  readingProgress: integer("reading_progress").notNull().default(0),
  isRss: boolean("is_rss").notNull().default(false),
  rssFeedId: integer("rss_feed_id"),
  intentType: text("intent_type").notNull().default("general"),
  actionItemsExtracted: boolean("action_items_extracted").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSavedArticleSchema = createInsertSchema(savedArticlesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSavedArticle = z.infer<typeof insertSavedArticleSchema>;
export type SavedArticle = typeof savedArticlesTable.$inferSelect;
