ALTER TABLE "gift_intents" ADD COLUMN "request_fingerprint_hash" varchar(64);--> statement-breakpoint
UPDATE "gift_intents" SET "request_fingerprint_hash" = repeat('0', 64) WHERE "request_fingerprint_hash" IS NULL;--> statement-breakpoint
ALTER TABLE "gift_intents" ALTER COLUMN "request_fingerprint_hash" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "gift_intents_request_fingerprint_idx" ON "gift_intents" USING btree ("request_fingerprint_hash");
