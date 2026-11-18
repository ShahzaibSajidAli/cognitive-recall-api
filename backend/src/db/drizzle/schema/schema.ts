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
  createdAt: timestamp("created_at").defaultNow().notNull(),
},
  (table) => [
    index("sessions_user_id_index").on(table.userId)
  ],
);

export const session_answers = pgTable("session_answers", {
  id: varchar("id", { length: 255 }).primaryKey(),
  sessionId: varchar("session_id", { length: 255 })
    .notNull()
    .references(() => sessions.id, {
      onDelete: "cascade"
    }),
  phases: jsonb("phases").$type<object[]>().notNull().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
},
  (table) => [
    index("session_answer_id_index").on(table.sessionId)
  ])

export const gradebook = pgTable("gradebook", {
  id: varchar("id", { length: 255 }).primaryKey(),
  sessionId: varchar("user_id", { length: 255 })
    .notNull()
    .references(() => sessions.id, {
      onDelete: "cascade",
    }),
  score: text("score").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
},
  (table) => [
    index("gradebook_sessions_id_index").on(table.sessionId)
  ]);

export type VideoQuestions = {
  general: { question: string; timestampSeconds: number }[];
  coding: { task: string; code: string; lang: string; filename: string }[];
};
export const videos = pgTable("videos", {
  videoId: varchar("video_id", { length: 255 }).primaryKey(),
  questions: jsonb("questions").$type<VideoQuestions>().notNull().default({ general: [], coding: [] }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertVideoSchema = createInsertSchema(videos);
export const selectVideoSchema = createSelectSchema(videos);