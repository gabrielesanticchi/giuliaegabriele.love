# Static Wedding Content Design

## Goal

Make the wedding site public by default and reduce the administration area to
the operational Lista Nozze workflow.

## Content ownership

- Hero, wedding date, venues, directions, and story are version-controlled
  TypeScript content.
- Gifts, reservations, contributions, and encrypted banking instructions remain
  in PostgreSQL.
- The public page never depends on an editorial publication record.
- A gift-query failure does not hide the wedding information; it produces an
  empty gift collection for that request.

## Administration

The visible navigation contains only Panoramica, Lista nozze, Richieste, and
Impostazioni. Impostazioni retains encrypted banking instructions. Request
timing remains deployment configuration because the existing admin fields did
not affect runtime behavior. Editorial pages,
media management, preview, readiness, publish/revoke actions, and the visible
audit-log page are removed from the active interface. Audit records continue to
be written and retained.

## Database cleanup

The obsolete `media_assets` and `story_moments` tables and the unused
`gifts.media_asset_id` column and unused `gifts.progress_mode` selector are
removed by destructive migrations explicitly approved on 6 September 2026. No
compatibility layer remains.

## Verification

Tests must prove that static content renders in production semantics, dynamic
gift state is mapped independently, database failure does not select a waiting
page, and removed admin destinations are absent. The full lint, typecheck, unit
test, database-schema check, formatting check, and production-build gates must
pass.
