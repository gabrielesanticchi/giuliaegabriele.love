ALTER TABLE "gift_intents" RENAME COLUMN "amount_euros" TO "amount_cents";--> statement-breakpoint
ALTER TABLE "gift_intents" RENAME COLUMN "received_amount_euros" TO "received_amount_cents";--> statement-breakpoint
ALTER TABLE "gift_intents" RENAME COLUMN "applied_amount_euros" TO "applied_amount_cents";--> statement-breakpoint
ALTER TABLE "gifts" RENAME COLUMN "price_euros" TO "price_cents";--> statement-breakpoint
ALTER TABLE "gift_intents" DROP CONSTRAINT "gift_intents_amount_nonnegative";--> statement-breakpoint
ALTER TABLE "gift_intents" DROP CONSTRAINT "gift_intents_received_nonnegative";--> statement-breakpoint
ALTER TABLE "gift_intents" DROP CONSTRAINT "gift_intents_applied_nonnegative";--> statement-breakpoint
ALTER TABLE "gift_intents" DROP CONSTRAINT "gift_intents_applied_lte_received";--> statement-breakpoint
ALTER TABLE "gifts" DROP CONSTRAINT "gifts_price_nonnegative";--> statement-breakpoint
ALTER TABLE "gifts" ADD COLUMN "product_url" text;--> statement-breakpoint
ALTER TABLE "gifts" ADD COLUMN "image_path" text;--> statement-breakpoint
UPDATE "gifts" SET "price_cents" = "price_cents" * 100 WHERE true;--> statement-breakpoint
UPDATE "gift_intents"
SET
	"amount_cents" = "amount_cents" * 100,
	"received_amount_cents" = "received_amount_cents" * 100,
	"applied_amount_cents" = "applied_amount_cents" * 100
WHERE true;--> statement-breakpoint
ALTER TABLE "gift_intents" ADD CONSTRAINT "gift_intents_amount_nonnegative" CHECK ("gift_intents"."amount_cents" >= 0);--> statement-breakpoint
ALTER TABLE "gift_intents" ADD CONSTRAINT "gift_intents_received_nonnegative" CHECK ("gift_intents"."received_amount_cents" is null or "gift_intents"."received_amount_cents" >= 0);--> statement-breakpoint
ALTER TABLE "gift_intents" ADD CONSTRAINT "gift_intents_applied_nonnegative" CHECK ("gift_intents"."applied_amount_cents" >= 0);--> statement-breakpoint
ALTER TABLE "gift_intents" ADD CONSTRAINT "gift_intents_applied_lte_received" CHECK ("gift_intents"."received_amount_cents" is null or "gift_intents"."applied_amount_cents" <= "gift_intents"."received_amount_cents");--> statement-breakpoint
ALTER TABLE "gifts" ADD CONSTRAINT "gifts_price_nonnegative" CHECK ("gifts"."price_cents" >= 0);
