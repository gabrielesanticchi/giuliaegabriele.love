DROP TABLE IF EXISTS "dress_code_colors" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "schedule_items" CASCADE;--> statement-breakpoint
ALTER TABLE "gifts" DROP CONSTRAINT "gifts_media_asset_id_media_assets_id_fk";
--> statement-breakpoint
ALTER TABLE "gifts" DROP COLUMN "media_asset_id";--> statement-breakpoint
DROP TABLE "story_moments";--> statement-breakpoint
DROP TABLE "media_assets";
