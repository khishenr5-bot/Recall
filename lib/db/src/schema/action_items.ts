import { pgTable, text, serial, timestamp, integer, jsonb, date, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { savedArticlesTable } from "./saved_articles";

export const actionItemsTable = pgTable(
  "action_items",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    articleId: integer("article_id").references(() => savedArticlesTable.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    intentType: text("intent_type").notNull().default("general"),
    status: text("status").notNull().default("pending"),
    priority: integer("priority").notNull().default(3),
    dueDate: date("due_date"),
    snoozedUntil: timestamp("snoozed_until", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("action_items_user_status_idx").on(t.userId, t.status),
    index("action_items_user_intent_idx").on(t.userId, t.intentType),
  ]
);

export const insertActionItemSchema = createInsertSchema(actionItemsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertActionItem = z.infer<typeof insertActionItemSchema>;
export type ActionItem = typeof actionItemsTable.$inferSelect;

export const actionPlansTable = pgTable(
  "action_plans",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    weekStart: date("week_start").notNull(),
    planJson: jsonb("plan_json").notNull(),
    userGoals: text("user_goals"),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("action_plans_user_week_idx").on(t.userId, t.weekStart)]
);

export type ActionPlan = typeof actionPlansTable.$inferSelect;
