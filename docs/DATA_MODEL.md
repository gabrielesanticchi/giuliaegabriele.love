# Data Model

Source of truth: `src/db/schema/tables.ts` (Drizzle ORM, PostgreSQL). This file
documents the relationships between tables. Regenerate the picture from the
schema whenever a foreign key is added or removed.

## Entity–relationship diagram

```mermaid
erDiagram
    admin_users ||--o{ admin_action_receipts : "actor_admin_id (cascade)"
    admin_users ||--o{ audit_logs : "actor_admin_id (set null)"

    media_assets ||--o{ story_moments : "media_asset_id (set null)"
    media_assets ||--o{ gifts : "media_asset_id (set null)"

    gift_categories ||--o{ gifts : "category_id (set null)"

    gifts ||--o{ gift_intents : "gift_id (cascade)"
    gifts ||--o| gift_locks : "gift_id PK (cascade)"

    gift_intents ||--o| gift_locks : "intent_id (cascade)"
    gift_intents ||--o{ email_deliveries : "intent_id (set null)"

    site_settings {
        varchar key PK
        jsonb value
        text encrypted_value
    }
    dress_code_colors {
        uuid id PK
    }
    schedule_items {
        uuid id PK
    }
    rate_limit_buckets {
        varchar fingerprint_hash PK
        varchar bucket_key PK
    }

    admin_users {
        uuid id PK
        varchar email_hash UK
        text email_encrypted
        text password_hash
        varchar role "owner | editor"
        int session_version
    }
    media_assets {
        uuid id PK
        text pathname UK
    }
    story_moments {
        uuid id PK
        uuid media_asset_id FK
    }
    gift_categories {
        uuid id PK
        varchar slug UK
    }
    gifts {
        uuid id PK
        varchar public_reference UK
        uuid category_id FK
        uuid media_asset_id FK
        int price_cents
        varchar progress_mode "hidden | discreet | exact"
    }
    gift_intents {
        uuid id PK
        uuid gift_id FK
        varchar public_reference UK
        varchar idempotency_key UK
        varchar guest_token_hash UK
        enum kind "full_gift | contribution"
        enum method "external_purchase | bank_transfer"
        enum status "pending | verified | cancelled | expired | rejected"
        int amount_cents
    }
    gift_locks {
        uuid gift_id PK-FK
        uuid intent_id FK-UK
        timestamptz expires_at
    }
    admin_action_receipts {
        uuid id PK
        uuid actor_admin_id FK
        varchar action
        varchar entity_id
        varchar idempotency_key
    }
    audit_logs {
        uuid id PK
        uuid actor_admin_id FK
    }
    email_deliveries {
        uuid id PK
        uuid intent_id FK
        varchar recipient_hash
        enum status "pending | sent | failed | skipped"
    }
```

## Foreign keys and delete behaviour

| Child table | Column | References | On delete |
|---|---|---|---|
| `story_moments` | `media_asset_id` | `media_assets.id` | set null |
| `gifts` | `category_id` | `gift_categories.id` | set null |
| `gifts` | `media_asset_id` | `media_assets.id` | set null |
| `gift_intents` | `gift_id` | `gifts.id` | cascade |
| `gift_locks` | `gift_id` (PK) | `gifts.id` | cascade |
| `gift_locks` | `intent_id` (unique) | `gift_intents.id` | cascade |
| `admin_action_receipts` | `actor_admin_id` | `admin_users.id` | cascade |
| `audit_logs` | `actor_admin_id` | `admin_users.id` | set null |
| `email_deliveries` | `intent_id` | `gift_intents.id` | set null |

Standalone tables with no foreign keys: `site_settings`, `schedule_items`,
`dress_code_colors`, `rate_limit_buckets`.

## Notes

- **Gift reservation flow.** A guest's reservation is a `gift_intents` row; while
  active it holds a single `gift_locks` row (one lock per gift, one lock per
  intent — both enforced by unique constraints), so only one reservation can be
  live for a gift at a time. Lock expiry is driven by `gift_locks.expires_at`.
- **Money is integer cents.** `price_cents`, `amount_cents`,
  `received_amount_cents`, `applied_amount_cents`; CHECK constraints keep them
  non-negative and `applied <= received`.
- **PII is hashed or encrypted, never plaintext.** Admin and guest emails are
  stored as an HMAC hash (lookup) plus an encrypted blob (recovery); `*_hash`
  columns are peppered HMACs used only for equality matching.
- **Soft delete.** Content tables (`media_assets`, `schedule_items`,
  `story_moments`, `dress_code_colors`, `gift_categories`, `gifts`) use
  `archived_at` rather than row deletion.
- **Idempotency.** `admin_action_receipts` and the `*_idempotency_key` columns
  on `gift_intents` / `email_deliveries` deduplicate retried operations.
