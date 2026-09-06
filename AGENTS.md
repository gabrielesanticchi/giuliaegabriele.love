# AGENTS.md

Guida concisa per agenti che lavorano su questo repository.

## Contesto

Sito di matrimonio full-stack (Next.js 16 App Router, TypeScript strict,
Drizzle/PostgreSQL, Auth.js con credenziali email + password). Italiano, fuso `Europe/Rome`, importi in
**centesimi interi**, nessun pagamento online.

## Comandi (Corepack pnpm guasto: usa `~/Library/pnpm/pnpm` o `node_modules/.bin`)

- Gate: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
- Formato: `pnpm format:check`; Drizzle: `pnpm db:check`
- Integration: servono `TEST_DATABASE_URL` reale — non dichiararli “passati” se
  non eseguiti. Vedi README per un cluster PostgreSQL effimero locale.
- E2E: `pnpm test:e2e` (Playwright + axe); `PLAYWRIGHT_CHROMIUM_PATH` per un
  browser già installato.

## Regole invariabili

- Nessun push, deploy, provisioning cloud o modifica DNS.
- Nessun segreto, IBAN reale o PII nel repo, nei log, nel bundle o nelle GET.
- IBAN solo nella risposta della mutation appena accettata, `no-store`, mai su
  replay. Token invitato solo come hash; idempotenza legata al payload.
- Lock a 48h bloccanti finché un admin non interviene; lock scaduti restano tali.
- Ogni mutation admin: sessione + ruolo lato server; effect + audit + receipt
  nella stessa transazione.
- Produzione fail-closed: nessun contenuto demo, env obbligatorie verificate al
  boot.
- Accessibilità WCAG 2.2 AA, `prefers-reduced-motion`, nessun overflow a 320px.

## Metodo

- TDD rigoroso: test fallente osservato → implementazione minima → verde →
  refactor. Correggi l'implementazione, non il test.
- File piccoli e coesi; niente mutazioni in-place; validare gli input ai confini.
- Errori del driver PostgreSQL: leggi i codici tramite `findPostgresError`
  (risale la catena `.cause`), non sull'errore di primo livello.

## Dove guardare

- Piano e stato: `PLAN.md`, `docs/superpowers/plans/`.
- Transazioni Lista Nozze: `src/db/transactions/`.
- Sicurezza/crittografia: `src/lib/security/`, `src/lib/auth/`.
- Adapter contenuti pubblici: `src/lib/public-content/adapter.ts`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
