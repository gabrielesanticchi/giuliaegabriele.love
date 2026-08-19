# Piano di realizzazione — stato al 19 agosto 2026

## Stato sintetico

| Milestone | Stato | Evidenza principale |
|---|---|---|
| 1. Fondazione, qualità e dominio | Completata | Commit `7b9414c`, `da93517`; review PASS |
| 2. PostgreSQL, cifratura e transazioni Lista Nozze | Completata | Commit `dd3d929` → `0ce1834`; review PASS |
| 3. Sistema grafico e sito pubblico | Completata | Commit `76e74b9` → `04f04e1`; review PASS |
| 4. API pubbliche e pagina invitato | Completata | Commit `cde0076` → `892b7a4`; security review PASS |
| 5. Auth.js, TOTP e amministrazione | Completata | Fix round 4; code+security review PASS (0 CRITICAL/HIGH) |
| 6. Blob, privacy, SEO e hardening finale | Completata | Blob upload, CSP/header, SEO, health, `.env.example`, scan segreti |
| 7. E2E, QA visuale e documentazione | Completata | migrate/seed/admin operativi, Playwright+axe 7/7, screenshot 390/768/1440, README/AGENTS |

## Baseline corrente

- `HEAD` prima del fix round 4: `2bbcc85` (`docs: add implementation handoff`).
- Ultimo gate eseguito (fix round 4): 221/221 unit test, typecheck, ESLint,
  Prettier, `drizzle-kit check` e build Next.js superati.
- **Integration test PostgreSQL eseguiti davvero**: 30/30 verdi contro un cluster
  PostgreSQL 15 effimero locale (socket in `/tmp/wpg`, TCP `127.0.0.1:54329`,
  `TEST_DATABASE_URL=postgres://wedding@127.0.0.1:54329/wedding_test`). Erano 22
  test mai eseguiti prima; ora 22 preesistenti + 8 nuovi.
- Il comando `pnpm` risolto tramite Corepack è guasto nell'ambiente corrente;
  usare `~/Library/pnpm/pnpm` oppure i binari in `node_modules/.bin`.
- Nessun deploy, push, provisioning Vercel o modifica DNS è stato eseguito.

## Bug di produzione scoperti eseguendo i test di integrazione (Task 2/4)

Entrambi non erano mai emersi perché la suite PostgreSQL non era mai stata
eseguita. Corretti con i test falliti come riproduzione:

1. `src/lib/security/rate-limit.ts` interpolava oggetti `Date` grezzi in
   frammenti `sql` dell'`onConflictDoUpdate`; il driver `postgres` va in crash
   (`Received an instance of Date`) ad ogni chiamata del rate limiter. Fix: bind
   di stringhe ISO con cast esplicito `::timestamptz`.
2. `src/db/transactions/gifts.ts` + `errors.ts` leggevano `code`/`constraint_name`
   sull'errore di primo livello, ma drizzle incapsula l'errore driver sotto
   `.cause`. Retry 40001, recovery idempotente 23505 e mapping gift-lock → 409
   erano quindi silenziosamente saltati (la garanzia “contesa → 409” non era di
   fatto rispettata). Fix: `findPostgresError` risale la catena `.cause` e
   seleziona il primo codice con forma SQLSTATE (5 caratteri).

## Fix round 4 di Task 5 — completato

1. Media della storia end-to-end: validazione stessa transazione (esiste e non
   archiviato), adapter pubblico con `{url, alt, focalPoint}` e resa timeline con
   `next/image`. Test valido/inesistente/archiviato.
2. Onboarding TOTP ripristinabile: `restartTotpEnrollmentAction` serializzata,
   auditata, che non tocca mai le credenziali attive. Test lost-response,
   concorrenza e completamento.
3. Datetime Europe/Rome: transform Zod con `ctx.addIssue` (niente eccezioni fuori
   da `safeParse`); la Server Action restituisce “Evento non valido”.
4. Email outbox: `intentId` nella delivery key, verifica identità sul conflict
   recovery, azione owner-only idempotente `processPendingEmailDeliveriesAction`
   in `/admin/richieste`, provider idempotency key stabile, Resend opzionale.

## Task 6 — completato

- Upload Blob autorizzato (`/api/admin/media/upload`, `handleUpload`) con
  allowlist MIME/dimensione (niente SVG), policy testata; la pathname salvata è
  la URL https del blob (risolve il vincolo `isSafeMediaUrl`).
- Env di produzione fail-closed (`src/lib/config/env.ts`, testato) verificate al
  boot da `instrumentation.ts`.
- Security header + CSP (`next.config.ts`): niente `unsafe-eval`; Turnstile e
  Blob con scope, HSTS, nosniff, frame DENY, referrer/permissions policy.
- SEO: `robots.ts` (Disallow: / in fase noindex), `sitemap.ts`, `manifest.ts`,
  OG/canonical, favicon; admin resta noindex.
- Health/readiness `/api/health` (503 se DB irraggiungibile).
- `.env.example` completo e documentato; scan segreti/PII pulito (nessun segreto
  nel bundle client, nessun IBAN o segreto hardcoded).

## Task 7 — completato

- `scripts/migrate.ts` e `scripts/seed.ts` (idempotente, dev/test only). Le CLI
  admin (create/list/reset) ora funzionano: aggiunto `--conditions=react-server`
  (stub di `server-only`) e `closeDatabase()` per evitare l'hang del pool.
- Playwright + axe: 7/7 verdi (home, skip-link/tastiera, accessibilità senza
  violazioni serious/critical, login admin, guardia dashboard, robots, health).
- Screenshot QA 390×844 / 768×1024 / 1440×900 con guardia anti-overflow;
  ispezione visiva OK (in `artifacts/`, git-ignored).
- `README.md`, `AGENTS.md`, `docs/PRODUCTION_CHECKLIST.md`.

## Note non bloccanti per l'evoluzione futura

- Story media: `next/image unoptimized` è volontario (media utente di origine
  variabile). Per abilitare l'ottimizzazione, aggiungere `images.remotePatterns`
  per l'host Blob e adeguare i test dei componenti.
- `deliverPendingEmailBatch` non usa `FOR UPDATE SKIP LOCKED`: il doppio click
  concorrente è comunque de-duplicato dalla provider idempotency key.
- CSP mantiene `unsafe-inline` per script/stili (richiesto dall'hydration Next);
  valutare una CSP a nonce via middleware come hardening successivo.

## Dopo Task 5

1. Task 6: Vercel Blob, upload sicuro, privacy/retention, SEO/OG, CSP/security
   header, health/readiness e `.env.example` definitivo.
2. Task 7: seed/CLI operativi, Playwright completo, axe, screenshot 390/768/1440,
   QA visuale, README/AGENTS e verifica finale.
3. Configurare `TEST_DATABASE_URL` e eseguire davvero la suite PostgreSQL prima
   di dichiarare completo il progetto.

Il piano esecutivo dettagliato resta in
`docs/superpowers/plans/2026-08-19-wedding-platform.md`; il handoff operativo è
in `docs/HANDOFF_CLAUDE.md`.
