# Piano di realizzazione — stato al 19 agosto 2026

## Stato sintetico

| Milestone | Stato | Evidenza principale |
|---|---|---|
| 1. Fondazione, qualità e dominio | Completata | Commit `7b9414c`, `da93517`; review PASS |
| 2. PostgreSQL, cifratura e transazioni Lista Nozze | Completata | Commit `dd3d929` → `0ce1834`; review PASS |
| 3. Sistema grafico e sito pubblico | Completata | Commit `76e74b9` → `04f04e1`; review PASS |
| 4. API pubbliche e pagina invitato | Completata | Commit `cde0076` → `892b7a4`; security review PASS |
| 5. Auth.js, TOTP e amministrazione | Completata | Fix round 4; code+security review PASS (0 CRITICAL/HIGH) |
| 6. Blob, privacy, SEO e hardening finale | In corso | Task 6 del piano esecutivo |
| 7. E2E, QA visuale e documentazione | Da iniziare | Task 7 del piano esecutivo |

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

## Note differite a Task 6 (dai review scoped)

- Il media della storia usa `next/image unoptimized`: in Task 6 configurare
  `images.remotePatterns` per l'host Vercel Blob e abilitare l'ottimizzazione.
- `media_assets.pathname` deve contenere una URL risolvibile (https assoluta) o
  un path root-relative: altrimenti `isSafeMediaUrl` scarta il media. Definire il
  formato definitivo con l'upload Blob.
- `deliverPendingEmailBatch` non usa `FOR UPDATE SKIP LOCKED`: doppio click
  concorrente è comunque de-duplicato dalla provider idempotency key; valutare
  il lock se si vuole eliminare il lavoro ridondante.

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
