CREATE TYPE "public"."email_delivery_status" AS ENUM('pending', 'sent', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."gift_intent_kind" AS ENUM('full_gift', 'contribution');--> statement-breakpoint
CREATE TYPE "public"."gift_intent_method" AS ENUM('external_purchase', 'bank_transfer');--> statement-breakpoint
CREATE TYPE "public"."gift_intent_status" AS ENUM('pending', 'verified', 'cancelled', 'expired', 'rejected');--> statement-breakpoint
CREATE TABLE "admin_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_hash" varchar(64) NOT NULL,
	"password_hash" text NOT NULL,
	"totp_secret_encrypted" text,
	"totp_enabled" boolean DEFAULT false NOT NULL,
	"disabled_at" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_admin_id" uuid,
	"actor_type" varchar(20) NOT NULL,
	"action" varchar(100) NOT NULL,
	"target_type" varchar(80) NOT NULL,
	"target_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dress_code_colors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(80) NOT NULL,
	"hex_color" varchar(7) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dress_code_colors_hex_format" CHECK ("dress_code_colors"."hex_color" ~ '^#[0-9A-Fa-f]{6}$')
);
--> statement-breakpoint
CREATE TABLE "email_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"intent_id" uuid,
	"recipient_hash" varchar(64) NOT NULL,
	"template_key" varchar(100) NOT NULL,
	"provider_message_id_hash" varchar(64),
	"status" "email_delivery_status" DEFAULT 'pending' NOT NULL,
	"failure_code" varchar(80),
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gift_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(100) NOT NULL,
	"name" varchar(150) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gift_intents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_reference" varchar(100) NOT NULL,
	"gift_id" uuid NOT NULL,
	"kind" "gift_intent_kind" NOT NULL,
	"method" "gift_intent_method" NOT NULL,
	"status" "gift_intent_status" DEFAULT 'pending' NOT NULL,
	"amount_cents" integer NOT NULL,
	"received_amount_cents" integer,
	"applied_amount_cents" integer DEFAULT 0 NOT NULL,
	"idempotency_key" varchar(128) NOT NULL,
	"request_fingerprint_hash" varchar(64) NOT NULL,
	"guest_token_hash" varchar(64) NOT NULL,
	"guest_details_encrypted" text NOT NULL,
	"guest_email_hash" varchar(64),
	"fingerprint_hash" varchar(64),
	"expires_at" timestamp with time zone NOT NULL,
	"payment_declared_at" timestamp with time zone,
	"guest_complete_idempotency_key" varchar(128),
	"guest_cancel_idempotency_key" varchar(128),
	"verified_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gift_intents_amount_nonnegative" CHECK ("gift_intents"."amount_cents" >= 0),
	CONSTRAINT "gift_intents_received_nonnegative" CHECK ("gift_intents"."received_amount_cents" is null or "gift_intents"."received_amount_cents" >= 0),
	CONSTRAINT "gift_intents_applied_nonnegative" CHECK ("gift_intents"."applied_amount_cents" >= 0),
	CONSTRAINT "gift_intents_applied_lte_received" CHECK ("gift_intents"."received_amount_cents" is null or "gift_intents"."applied_amount_cents" <= "gift_intents"."received_amount_cents")
);
--> statement-breakpoint
CREATE TABLE "gift_locks" (
	"gift_id" uuid PRIMARY KEY NOT NULL,
	"intent_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_reference" varchar(80) NOT NULL,
	"category_id" uuid,
	"media_asset_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"price_cents" integer NOT NULL,
	"progress_mode" varchar(20) DEFAULT 'discreet' NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gifts_price_nonnegative" CHECK ("gifts"."price_cents" >= 0),
	CONSTRAINT "gifts_progress_mode_valid" CHECK ("gifts"."progress_mode" in ('hidden', 'discreet', 'exact'))
);
--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pathname" text NOT NULL,
	"content_type" varchar(127) NOT NULL,
	"size_bytes" integer NOT NULL,
	"alt_text" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_assets_size_nonnegative" CHECK ("media_assets"."size_bytes" >= 0)
);
--> statement-breakpoint
CREATE TABLE "rate_limit_buckets" (
	"fingerprint_hash" varchar(64) NOT NULL,
	"bucket_key" varchar(100) NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rate_limit_buckets_pk" PRIMARY KEY("fingerprint_hash","bucket_key"),
	CONSTRAINT "rate_limit_buckets_count_nonnegative" CHECK ("rate_limit_buckets"."count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "schedule_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"location_name" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"key" varchar(100) PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"encrypted_value" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "story_moments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"occurred_on" timestamp with time zone,
	"media_asset_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_admin_id_admin_users_id_fk" FOREIGN KEY ("actor_admin_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_deliveries" ADD CONSTRAINT "email_deliveries_intent_id_gift_intents_id_fk" FOREIGN KEY ("intent_id") REFERENCES "public"."gift_intents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_intents" ADD CONSTRAINT "gift_intents_gift_id_gifts_id_fk" FOREIGN KEY ("gift_id") REFERENCES "public"."gifts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_locks" ADD CONSTRAINT "gift_locks_gift_id_gifts_id_fk" FOREIGN KEY ("gift_id") REFERENCES "public"."gifts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_locks" ADD CONSTRAINT "gift_locks_intent_id_gift_intents_id_fk" FOREIGN KEY ("intent_id") REFERENCES "public"."gift_intents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gifts" ADD CONSTRAINT "gifts_category_id_gift_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."gift_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gifts" ADD CONSTRAINT "gifts_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_moments" ADD CONSTRAINT "story_moments_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "admin_users_email_hash_unique" ON "admin_users" USING btree ("email_hash");--> statement-breakpoint
CREATE INDEX "audit_logs_target_idx" ON "audit_logs" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "email_deliveries_intent_idx" ON "email_deliveries" USING btree ("intent_id");--> statement-breakpoint
CREATE INDEX "email_deliveries_recipient_hash_idx" ON "email_deliveries" USING btree ("recipient_hash");--> statement-breakpoint
CREATE INDEX "email_deliveries_status_idx" ON "email_deliveries" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "gift_categories_slug_unique" ON "gift_categories" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "gift_intents_public_reference_unique" ON "gift_intents" USING btree ("public_reference");--> statement-breakpoint
CREATE UNIQUE INDEX "gift_intents_idempotency_key_unique" ON "gift_intents" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "gift_intents_guest_token_hash_unique" ON "gift_intents" USING btree ("guest_token_hash");--> statement-breakpoint
CREATE INDEX "gift_intents_gift_idx" ON "gift_intents" USING btree ("gift_id");--> statement-breakpoint
CREATE INDEX "gift_intents_status_idx" ON "gift_intents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "gift_intents_expires_at_idx" ON "gift_intents" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "gift_intents_gift_status_expiry_idx" ON "gift_intents" USING btree ("gift_id","status","expires_at");--> statement-breakpoint
CREATE INDEX "gift_intents_email_hash_idx" ON "gift_intents" USING btree ("guest_email_hash");--> statement-breakpoint
CREATE INDEX "gift_intents_request_fingerprint_idx" ON "gift_intents" USING btree ("request_fingerprint_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "gift_locks_intent_unique" ON "gift_locks" USING btree ("intent_id");--> statement-breakpoint
CREATE INDEX "gift_locks_expires_at_idx" ON "gift_locks" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "gifts_public_reference_unique" ON "gifts" USING btree ("public_reference");--> statement-breakpoint
CREATE INDEX "gifts_category_idx" ON "gifts" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "gifts_completed_idx" ON "gifts" USING btree ("completed");--> statement-breakpoint
CREATE UNIQUE INDEX "media_assets_pathname_unique" ON "media_assets" USING btree ("pathname");--> statement-breakpoint
CREATE INDEX "rate_limit_buckets_expires_at_idx" ON "rate_limit_buckets" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "schedule_items_starts_at_idx" ON "schedule_items" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "story_moments_sort_order_idx" ON "story_moments" USING btree ("sort_order");
