import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const voiceNotesTable = pgTable("voice_notes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  transcript: text("transcript").notNull(),
  summary: text("summary"),
  tags: text("tags").array().notNull().default([]),
  sourceUrl: text("source_url"),
  sourceTitle: text("source_title"),
  pageContext: text("page_context"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertVoiceNoteSchema = createInsertSchema(voiceNotesTable).omit({ id: true, createdAt: true });
export type InsertVoiceNote = z.infer<typeof insertVoiceNoteSchema>;
export type VoiceNote = typeof voiceNotesTable.$inferSelect;
