ALTER TABLE "admin_users" DROP COLUMN "totp_secret_encrypted";--> statement-breakpoint
ALTER TABLE "admin_users" DROP COLUMN "pending_totp_secret_encrypted";--> statement-breakpoint
ALTER TABLE "admin_users" DROP COLUMN "pending_recovery_code_hashes";--> statement-breakpoint
ALTER TABLE "admin_users" DROP COLUMN "recovery_code_hashes";--> statement-breakpoint
ALTER TABLE "admin_users" DROP COLUMN "totp_enabled";