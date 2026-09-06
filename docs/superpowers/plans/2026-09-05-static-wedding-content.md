# Static Wedding Content Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish code-owned wedding content by default and reduce admin to Lista Nozze operations.

**Architecture:** A server-rendered homepage combines an immutable TypeScript content object with gifts loaded from PostgreSQL. The admin exposes only dashboard, gift management, requests, and operational settings. Obsolete editorial storage is removed.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Drizzle ORM, PostgreSQL, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-05-static-wedding-content-design.md`

## Global Constraints

- Remove obsolete editorial storage; destructive cleanup approved on 6 September 2026.
- No new dependencies or environment variables.
- Preserve server-side authorization and transactional audit behavior.
- Preserve WCAG 2.2 AA behavior and 320px compatibility.
- Use `~/Library/pnpm/pnpm` for project commands.

---

### Task 1: Separate static wedding content from dynamic gifts

**Files:**
- Create: `src/data/site-content.ts`
- Modify: `src/lib/public-content/adapter.ts`
- Modify: `src/app/(public)/page.tsx`
- Modify: `src/components/sections/public-home.tsx`
- Modify: `src/components/sections/gift-registry.tsx`
- Test: `tests/unit/public-content-adapter.test.ts`
- Test: `tests/unit/public-home.test.tsx`

**Interfaces:**
- Produces: `siteContent: Omit<PublicContent, "gifts">`
- Produces: `loadPublicGifts(): Promise<PublicGift[]>`
- Produces: `loadPublicGiftsSafely(loader?): Promise<PublicGift[]>`

- [ ] Write tests proving static content is environment-independent and gift failures return an empty list.
- [ ] Run the focused tests and observe failures caused by the missing interfaces.
- [ ] Add the static content module and reduce the database adapter to gift mapping only.
- [ ] Combine static content and dynamic gifts in the public Server Component.
- [ ] Run the focused tests and confirm they pass.

### Task 2: Remove editorial publication controls from admin

**Files:**
- Modify: `src/components/admin/admin-navigation.tsx`
- Modify: `src/app/admin/(panel)/page.tsx`
- Modify: `src/app/admin/(panel)/[section]/page.tsx`
- Modify: `src/actions/admin/settings.ts`
- Delete: `src/lib/admin/readiness.ts`
- Delete: `src/app/admin/(panel)/preview/page.tsx`
- Test: `tests/unit/admin-ui.test.tsx`
- Test: `tests/unit/admin-server-action-boundaries.test.ts`
- Test: `tests/unit/admin-policies.test.ts`

**Interfaces:**
- Admin sections: `regali | richieste | impostazioni`
- Settings retains the encrypted `saveBankingAction`; request timing remains an
  environment setting because the removed fields were not runtime inputs.

- [ ] Write tests requiring the four-link navigation and absence of editorial destinations.
- [ ] Run the focused tests and observe the old navigation failure.
- [ ] Remove editorial routes, imports, publication actions, and readiness UI.
- [ ] Keep audit persistence while removing its navigation/page.
- [ ] Run the focused tests and confirm they pass.

### Task 3: Remove obsolete demo/editorial code and verify production

**Files:**
- Delete: `src/data/demo-content.ts`
- Delete: `src/actions/admin/content.ts`
- Modify: affected tests and imports.
- Modify: `README.md`

**Interfaces:**
- All public content types come from `src/data/site-content.ts`.
- No runtime import references demo content or editorial admin actions.

- [ ] Remove obsolete modules after all consumers have moved.
- [ ] Search for stale demo/publication/editorial imports.
- [ ] Run formatting and schema checks.
- [ ] Run lint, typecheck, all unit tests, and the production build.

### Task 4: Remove obsolete database and server interfaces

**Files:**
- Modify: `src/db/schema/tables.ts`
- Create: `drizzle/0004_sweet_quasimodo.sql`
- Modify: `src/actions/admin/gifts.ts`
- Modify: `src/actions/admin/shared.ts`
- Modify: `src/lib/admin/action-policies.ts`
- Modify: `src/lib/admin/idempotency.ts`
- Test: `tests/integration/schema-bootstrap.test.ts`

- [x] Prove the final migrated schema still contains editorial storage.
- [x] Drop `media_assets`, `story_moments`, `gifts.media_asset_id`, and the
  unused `gifts.progress_mode` selector.
- [x] Remove unused gift ordering actions and obsolete publication naming.
- [x] Run the full PostgreSQL integration suite.
- [x] Run the final quality gate.
