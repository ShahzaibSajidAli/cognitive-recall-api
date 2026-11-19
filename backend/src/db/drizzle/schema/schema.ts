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
    index("refresh_tokens_user_id_index").on(table.userId)
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

type Phase = {
  // Define the properties of a phase object here
  // For example:
  name: string;
  value: string;
  // Add more fields as needed
};

export const response_answers = pgTable("response_answers", {
  id: uuid("id").defaultRandom().primaryKey(),
  responseId: varchar("response_id", { length: 255 })
    .notNull()
    .references(() => responses.id, {
      onDelete: "cascade"
    }),
  phases: jsonb("phases").$type<Phase[]>().notNull().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
},
  (table) => [
    index("response_answer_id_index").on(table.responseId)
  ])

export const gradebook = pgTable("gradebook", {
  id: uuid("id").defaultRandom().primaryKey(),
  responseId: varchar("response_id", { length: 255 })
    .notNull()
    .references(() => responses.id, {
      onDelete: "cascade",
    }),
  score: text("score").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
},
  (table) => [
    index("gradebook_response_id_index").on(table.responseId)
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