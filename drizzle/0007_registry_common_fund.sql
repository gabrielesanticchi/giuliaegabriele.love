ALTER TABLE "gift_intents" ALTER COLUMN "gift_id" DROP NOT NULL;--> statement-breakpoint
UPDATE "gift_intents" SET "gift_id" = NULL WHERE "kind" = 'contribution';--> statement-breakpoint
ALTER TABLE "gift_intents" ADD CONSTRAINT "gift_intents_full_gift_requires_gift" CHECK ("gift_intents"."kind" <> 'full_gift' or "gift_intents"."gift_id" is not null);--> statement-breakpoint
ALTER TABLE "gift_intents" ADD CONSTRAINT "gift_intents_contribution_has_no_gift" CHECK ("gift_intents"."kind" <> 'contribution' or "gift_intents"."gift_id" is null);
