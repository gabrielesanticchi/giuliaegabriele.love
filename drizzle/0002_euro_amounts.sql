ALTER TABLE "gifts" RENAME COLUMN "price_cents" TO "price_euros";--> statement-breakpoint
ALTER TABLE "gift_intents" RENAME COLUMN "amount_cents" TO "amount_euros";--> statement-breakpoint
ALTER TABLE "gift_intents" RENAME COLUMN "received_amount_cents" TO "received_amount_euros";--> statement-breakpoint
ALTER TABLE "gift_intents" RENAME COLUMN "applied_amount_cents" TO "applied_amount_euros";--> statement-breakpoint
UPDATE "gifts" SET "price_euros" = round("price_euros" / 100.0)::integer;--> statement-breakpoint
UPDATE "gift_intents" SET "amount_euros" = round("amount_euros" / 100.0)::integer, "applied_amount_euros" = round("applied_amount_euros" / 100.0)::integer, "received_amount_euros" = round("received_amount_euros" / 100.0)::integer WHERE true;
