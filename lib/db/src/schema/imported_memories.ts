import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const importedMemoriesTable = pgTable("imported_memories", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  source: text("source").notNull(),
  title: text("title"),
  content: text("content").notNull(),
  summary: text("summary"),
  tags: text("tags").array().notNull().default([]),
  originalDate: timestamp("original_date", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertImportedMemorySchema = createInsertSchema(importedMemoriesTable).omit({ id: true, createdAt: true });
export type InsertImportedMemory = z.infer<typeof insertImportedMemorySchema>;
export type ImportedMemory = typeof importedMemoriesTable.$inferSelect;
