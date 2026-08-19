CREATE TABLE "admin_action_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_admin_id" uuid NOT NULL,
	"action" varchar(100) NOT NULL,
	"idempotency_key" varchar(128) NOT NULL,
	"result" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "email_encrypted" text NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "role" varchar(20) DEFAULT 'editor' NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "session_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "pending_totp_secret_encrypted" text;--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "recovery_code_hashes" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "gift_intents" ADD COLUMN "rejected_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "gift_intents" ADD COLUMN "admin_note" text;--> statement-breakpoint
ALTER TABLE "gifts" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "admin_action_receipts" ADD CONSTRAINT "admin_action_receipts_actor_admin_id_admin_users_id_fk" FOREIGN KEY ("actor_admin_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "admin_action_receipts_action_key_unique" ON "admin_action_receipts" USING btree ("actor_admin_id","action","idempotency_key");--> statement-breakpoint
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_role_valid" CHECK ("admin_users"."role" in ('owner', 'editor'));--> statement-breakpoint
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_session_version_positive" CHECK ("admin_users"."session_version" >= 1);