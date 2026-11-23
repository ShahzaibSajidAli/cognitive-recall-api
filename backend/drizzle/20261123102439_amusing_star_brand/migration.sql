ALTER TABLE "videos" ADD COLUMN "language" varchar(255);--> statement-breakpoint
UPDATE "videos" SET "language" = '' WHERE "language" IS NULL;--> statement-breakpoint
ALTER TABLE "videos" ALTER COLUMN "language" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "videos" DROP CONSTRAINT "videos_pkey";--> statement-breakpoint
ALTER TABLE "videos" ADD PRIMARY KEY ("video_id","language");