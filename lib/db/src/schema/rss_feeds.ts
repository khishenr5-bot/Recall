import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const rssFeedsTable = pgTable("rss_feeds", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  feedUrl: text("feed_url").notNull(),
  feedName: text("feed_name").notNull(),
  lastFetchedAt: timestamp("last_fetched_at", { withTimezone: true }),
  isActive: boolean("is_active").notNull().default(true),
  articleCount: integer("article_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertRssFeedSchema = createInsertSchema(rssFeedsTable).omit({ id: true, createdAt: true });
export type InsertRssFeed = z.infer<typeof insertRssFeedSchema>;
export type RssFeed = typeof rssFeedsTable.$inferSelect;
