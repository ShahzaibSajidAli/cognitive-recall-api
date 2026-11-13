import { createInsertSchema, createSelectSchema } from "drizzle-orm/zod";
import { jsonb, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

export const videos = pgTable("videos", {
  videoId: varchar("video_id", { length: 255 }).primaryKey(),
  questions: jsonb("questions").$type<string[]>().notNull().default([]),
  codingPractices: jsonb("coding_practices")
    .$type<string[]>()
    .notNull()
    .default([]),
  transcript: jsonb("transcript").$type<string[]>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertVideoSchema = createInsertSchema(videos);
export const selectVideoSchema = createSelectSchema(videos);