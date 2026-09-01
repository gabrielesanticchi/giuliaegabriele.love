import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
};

export const giftIntentKind = pgEnum("gift_intent_kind", [
  "full_gift",
  "contribution"
]);
export const giftIntentMethod = pgEnum("gift_intent_method", [
  "external_purchase",
  "bank_transfer"
]);
export const giftIntentStatus = pgEnum("gift_intent_status", [
  "pending",
  "verified",
  "cancelled",
  "expired",
  "rejected"
]);
export const emailDeliveryStatus = pgEnum("email_delivery_status", [
  "pending",
  "sent",
  "failed",
  "skipped"
]);

export const adminUsers = pgTable(
  "admin_users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    emailHash: varchar("email_hash", { length: 64 }).notNull(),
    emailEncrypted: text("email_encrypted").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: varchar("role", { length: 20 }).default("editor").notNull(),
    sessionVersion: integer("session_version").default(1).notNull(),
    disabledAt: timestamp("disabled_at", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    ...timestamps
  },
  (table) => [
    uniqueIndex("admin_users_email_hash_unique").on(table.emailHash),
    check("admin_users_role_valid", sql`${table.role} in ('owner', 'editor')`),
    check(
      "admin_users_session_version_positive",
      sql`${table.sessionVersion} >= 1`
    )
  ]
);

export const siteSettings = pgTable("site_settings", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: jsonb("value").notNull(),
  encryptedValue: text("encrypted_value"),
  ...timestamps
});

export const mediaAssets = pgTable(
  "media_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    pathname: text("pathname").notNull(),
    contentType: varchar("content_type", { length: 127 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    altText: text("alt_text").default("").notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps
  },
  (table) => [
    uniqueIndex("media_assets_pathname_unique").on(table.pathname),
    check("media_assets_size_nonnegative", sql`${table.sizeBytes} >= 0`)
  ]
);

export const scheduleItems = pgTable(
  "schedule_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    locationName: text("location_name"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    sortOrder: integer("sort_order").default(0).notNull(),
    published: boolean("published").default(false).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps
  },
  (table) => [index("schedule_items_starts_at_idx").on(table.startsAt)]
);

export const storyMoments = pgTable(
  "story_moments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    occurredOn: timestamp("occurred_on", {
      withTimezone: true,
      mode: "date"
    }),
    mediaAssetId: uuid("media_asset_id").references(() => mediaAssets.id, {
      onDelete: "set null"
    }),
    sortOrder: integer("sort_order").default(0).notNull(),
    published: boolean("published").default(false).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps
  },
  (table) => [index("story_moments_sort_order_idx").on(table.sortOrder)]
);

export const dressCodeColors = pgTable(
  "dress_code_colors",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 80 }).notNull(),
    hexColor: varchar("hex_color", { length: 7 }).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps
  },
  (table) => [
    check(
      "dress_code_colors_hex_format",
      sql`${table.hexColor} ~ '^#[0-9A-Fa-f]{6}$'`
    )
  ]
);

export const giftCategories = pgTable(
  "gift_categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: varchar("slug", { length: 100 }).notNull(),
    name: varchar("name", { length: 150 }).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps
  },
  (table) => [uniqueIndex("gift_categories_slug_unique").on(table.slug)]
);

export const gifts = pgTable(
  "gifts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    publicReference: varchar("public_reference", { length: 80 }).notNull(),
    categoryId: uuid("category_id").references(() => giftCategories.id, {
      onDelete: "set null"
    }),
    mediaAssetId: uuid("media_asset_id").references(() => mediaAssets.id, {
      onDelete: "set null"
    }),
    title: text("title").notNull(),
    description: text("description"),
    priceEuros: integer("price_euros").notNull(),
    progressMode: varchar("progress_mode", { length: 20 })
      .default("discreet")
      .notNull(),
    completed: boolean("completed").default(false).notNull(),
    published: boolean("published").default(false).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    sortOrder: integer("sort_order").default(0).notNull(),
    ...timestamps
  },
  (table) => [
    uniqueIndex("gifts_public_reference_unique").on(table.publicReference),
    index("gifts_category_idx").on(table.categoryId),
    index("gifts_completed_idx").on(table.completed),
    check("gifts_price_nonnegative", sql`${table.priceEuros} >= 0`),
    check(
      "gifts_progress_mode_valid",
      sql`${table.progressMode} in ('hidden', 'discreet', 'exact')`
    )
  ]
);

export const giftIntents = pgTable(
  "gift_intents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    publicReference: varchar("public_reference", { length: 100 }).notNull(),
    giftId: uuid("gift_id")
      .notNull()
      .references(() => gifts.id, { onDelete: "cascade" }),
    kind: giftIntentKind("kind").notNull(),
    method: giftIntentMethod("method").notNull(),
    status: giftIntentStatus("status").default("pending").notNull(),
    amountEuros: integer("amount_euros").notNull(),
    receivedAmountEuros: integer("received_amount_euros"),
    appliedAmountEuros: integer("applied_amount_euros").default(0).notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull(),
    requestFingerprintHash: varchar("request_fingerprint_hash", {
      length: 64
    }).notNull(),
    guestTokenHash: varchar("guest_token_hash", { length: 64 }).notNull(),
    guestDetailsEncrypted: text("guest_details_encrypted").notNull(),
    guestEmailHash: varchar("guest_email_hash", { length: 64 }),
    fingerprintHash: varchar("fingerprint_hash", { length: 64 }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    paymentDeclaredAt: timestamp("payment_declared_at", {
      withTimezone: true
    }),
    guestCompleteIdempotencyKey: varchar("guest_complete_idempotency_key", {
      length: 128
    }),
    guestCancelIdempotencyKey: varchar("guest_cancel_idempotency_key", {
      length: 128
    }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    rejectedAt: timestamp("rejected_at", { withTimezone: true }),
    adminNote: text("admin_note"),
    ...timestamps
  },
  (table) => [
    uniqueIndex("gift_intents_public_reference_unique").on(
      table.publicReference
    ),
    uniqueIndex("gift_intents_idempotency_key_unique").on(table.idempotencyKey),
    uniqueIndex("gift_intents_guest_token_hash_unique").on(
      table.guestTokenHash
    ),
    index("gift_intents_gift_idx").on(table.giftId),
    index("gift_intents_status_idx").on(table.status),
    index("gift_intents_expires_at_idx").on(table.expiresAt),
    index("gift_intents_gift_status_expiry_idx").on(
      table.giftId,
      table.status,
      table.expiresAt
    ),
    index("gift_intents_email_hash_idx").on(table.guestEmailHash),
    index("gift_intents_request_fingerprint_idx").on(
      table.requestFingerprintHash
    ),
    check("gift_intents_amount_nonnegative", sql`${table.amountEuros} >= 0`),
    check(
      "gift_intents_received_nonnegative",
      sql`${table.receivedAmountEuros} is null or ${table.receivedAmountEuros} >= 0`
    ),
    check(
      "gift_intents_applied_nonnegative",
      sql`${table.appliedAmountEuros} >= 0`
    ),
    check(
      "gift_intents_applied_lte_received",
      sql`${table.receivedAmountEuros} is null or ${table.appliedAmountEuros} <= ${table.receivedAmountEuros}`
    )
  ]
);

export const adminActionReceipts = pgTable(
  "admin_action_receipts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorAdminId: uuid("actor_admin_id")
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    action: varchar("action", { length: 100 }).notNull(),
    entityId: varchar("entity_id", { length: 160 }).notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull(),
    payloadHash: varchar("payload_hash", { length: 64 }).notNull(),
    status: varchar("status", { length: 20 }).default("pending").notNull(),
    result: jsonb("result").default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    uniqueIndex("admin_action_receipts_action_key_unique").on(
      table.actorAdminId,
      table.action,
      table.entityId,
      table.idempotencyKey
    ),
    check(
      "admin_action_receipts_status_valid",
      sql`${table.status} in ('pending', 'completed')`
    )
  ]
);

export const giftLocks = pgTable(
  "gift_locks",
  {
    giftId: uuid("gift_id")
      .primaryKey()
      .references(() => gifts.id, { onDelete: "cascade" }),
    intentId: uuid("intent_id")
      .notNull()
      .references(() => giftIntents.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    uniqueIndex("gift_locks_intent_unique").on(table.intentId),
    index("gift_locks_expires_at_idx").on(table.expiresAt)
  ]
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorAdminId: uuid("actor_admin_id").references(() => adminUsers.id, {
      onDelete: "set null"
    }),
    actorType: varchar("actor_type", { length: 20 }).notNull(),
    action: varchar("action", { length: 100 }).notNull(),
    targetType: varchar("target_type", { length: 80 }).notNull(),
    targetId: uuid("target_id"),
    metadata: jsonb("metadata").default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    index("audit_logs_target_idx").on(table.targetType, table.targetId),
    index("audit_logs_created_at_idx").on(table.createdAt)
  ]
);

export const rateLimitBuckets = pgTable(
  "rate_limit_buckets",
  {
    fingerprintHash: varchar("fingerprint_hash", { length: 64 }).notNull(),
    bucketKey: varchar("bucket_key", { length: 100 }).notNull(),
    count: integer("count").default(0).notNull(),
    windowStartedAt: timestamp("window_started_at", {
      withTimezone: true
    }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    primaryKey({
      name: "rate_limit_buckets_pk",
      columns: [table.fingerprintHash, table.bucketKey]
    }),
    index("rate_limit_buckets_expires_at_idx").on(table.expiresAt),
    check("rate_limit_buckets_count_nonnegative", sql`${table.count} >= 0`)
  ]
);

export const emailDeliveries = pgTable(
  "email_deliveries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    intentId: uuid("intent_id").references(() => giftIntents.id, {
      onDelete: "set null"
    }),
    recipientHash: varchar("recipient_hash", { length: 64 }).notNull(),
    templateKey: varchar("template_key", { length: 100 }).notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 128 }),
    providerMessageIdHash: varchar("provider_message_id_hash", { length: 64 }),
    status: emailDeliveryStatus("status").default("pending").notNull(),
    failureCode: varchar("failure_code", { length: 80 }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    index("email_deliveries_intent_idx").on(table.intentId),
    index("email_deliveries_recipient_hash_idx").on(table.recipientHash),
    index("email_deliveries_status_idx").on(table.status),
    uniqueIndex("email_deliveries_idempotency_unique").on(table.idempotencyKey)
  ]
);
