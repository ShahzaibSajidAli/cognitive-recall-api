import { createInsertSchema, createSelectSchema } from "drizzle-orm/zod";
import { jsonb, pgTable, text, timestamp, varchar, index, uuid } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  username: varchar("username", { length: 255}).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", {length: 255}).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const refreshTokens = pgTable("refresh_tokens", {
  id: varchar("id", { length: 255}).primaryKey(),
  userId: varchar("user_id", { length: 255 })
    .notNull()
    .references(() => users.id, {
      onDelete: "cascade",
    }),
  expiresAt: timestamp("expires_at"),
},
  (table) => [
    index("sessions_user_id_index").on(table.userId)
  ],
);

export const responses = pgTable("responses", {
  id: uuid("id").defaultRandom().primaryKey(),
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

export const response_answers = pgTable("response_answers", {
  id: uuid("id").defaultRandom().primaryKey(),
  responseId: varchar("session_id", { length: 255 })
    .notNull()
    .references(() => responses.id, {
      onDelete: "cascade"
    }),
  phases: jsonb("phases").$type<object[]>().notNull().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
},
  (table) => [
    index("session_answer_id_index").on(table.responseId)
  ])

export const gradebook = pgTable("gradebook", {
  id: uuid("id").defaultRandom().primaryKey(),
  responseId: varchar("user_id", { length: 255 })
    .notNull()
    .references(() => responses.id, {
      onDelete: "cascade",
    }),
  score: text("score").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
},
  (table) => [
    index("gradebook_sessions_id_index").on(table.responseId)
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