import {pgTable, serial, text, timestamp, varchar} from "drizzle-orm/pg-core";

export const videos = pgTable('videos', {
    id: serial('id').primaryKey(),
    videoUrl: varchar('video_url', { length: 255 }).notNull(),
    transcript: text('transcript').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});