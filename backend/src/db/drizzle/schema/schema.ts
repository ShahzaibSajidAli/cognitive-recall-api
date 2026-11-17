import { createInsertSchema, createSelectSchema } from "drizzle-orm/zod";
import { jsonb, pgTable, text, timestamp, varchar, index } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: varchar("id", { length: 255 }).primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sessions = pgTable("sessions", {
  id: varchar("id", { length: 255 }).primaryKey(),
  userId: varchar("user_id", { length: 255 })
    .notNull()
    .references(() => users.id, {
      onDelete: "cascade",
    }),
  answeredQuestions: jsonb("answered_questions").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
},
  (table) => [
    index("sessions_user_id_index").on(table.userId)
  ],
);

export const gradebook = pgTable("gradebook", {
  id: varchar("id", { length: 255 }).primaryKey(),
  userId: varchar("user_id", { length: 255 })
    .notNull()
    .references(() => users.id, {
      onDelete: "cascade",
    }),
  conceptId: varchar("concept_id", { length: 255 }).notNull(),
  score: text("score").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
},
  (table) => [
    index("gradebook_user_id_index").on(table.userId)
  ]);

export const videos = pgTable("videos", {
  videoId: varchar("video_id", { length: 255 }).primaryKey(),
  // Concepts with id and name stored with related questions in JSONB format
  concepts: jsonb("concepts").$type<{ id: string; name: string; questions: { general: { question: string; timestampSeconds: number }[]; coding: { task: string; code: string; lang: string; filename: string }[] } }[]>().notNull().default([]),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertVideoSchema = createInsertSchema(videos);
export const selectVideoSchema = createSelectSchema(videos);