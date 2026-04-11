import { pgTable, text, serial, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const researchReportsTable = pgTable("research_reports", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  question: text("question").notNull(),
  executiveSummary: text("executive_summary").notNull().default(""),
  subQuestions: jsonb("sub_questions").$type<string[]>().notNull().default([]),
  findings: text("findings").notNull().default(""),
  knowledgeGaps: jsonb("knowledge_gaps").$type<string[]>().notNull().default([]),
  searchQueries: jsonb("search_queries").$type<string[]>().notNull().default([]),
  recommendedReads: jsonb("recommended_reads").$type<string[]>().notNull().default([]),
  sources: jsonb("sources").$type<{ id: number; title: string }[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertResearchReportSchema = createInsertSchema(researchReportsTable).omit({ id: true, createdAt: true });
export type InsertResearchReport = z.infer<typeof insertResearchReportSchema>;
export type ResearchReport = typeof researchReportsTable.$inferSelect;
