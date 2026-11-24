import { createInsertSchema, createSelectSchema } from "drizzle-orm/zod";
import { jsonb, pgTable, text, timestamp, varchar, index, uuid, primaryKey, boolean } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  username: varchar("username", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
      }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
  },
  (table) => [
    index("refresh_tokens_user_id_index").on(table.userId),
    index("refresh_tokens_expires_at_index").on(table.expiresAt),
  ]
);

export const responses = pgTable(
  "responses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
      }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("responses_user_id_index").on(table.userId), // <-- Renamed cleanly
  ]
);

type Phase = {
  name: string;
  value: string;
};

export const response_answers = pgTable(
  "response_answers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    responseId: uuid("response_id")
      .notNull()
      .references(() => responses.id, {
        onDelete: "cascade",
      }),
    phases: jsonb("phases").$type<Phase[]>().notNull().default([]),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("response_answer_id_index").on(table.responseId),
  ]
);

export const gradebook = pgTable(
  "gradebook",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    responseId: uuid("response_id")
      .notNull()
      .references(() => responses.id, {
        onDelete: "cascade",
      }),
    score: text("score").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("gradebook_response_id_index").on(table.responseId),
  ]
);

export type VideoQuestions = {
  general: { question: string; timestampSeconds: number }[];
  coding: { task: string; code: string; lang: string; filename: string }[];
};

export type TranscriptOutput = {
  educational: boolean;
  questions: VideoQuestions;
};

export const videos = pgTable("videos", {
  videoId: varchar("video_id", { length: 255 }).notNull(),
  language: varchar("language", { length: 255 }).notNull(),
  educational: boolean("educational").notNull().default(true),
  questions: jsonb("questions").$type<VideoQuestions>().notNull().default({ general: [], coding: [] }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  primaryKey({ columns: [table.videoId, table.language] }),
]);

export const insertVideoSchema = createInsertSchema(videos);
export const selectVideoSchema = createSelectSchema(videos);
