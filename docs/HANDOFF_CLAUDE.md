# Handoff per Claude Code

## Obiettivo

Continuare l'implementazione del wedding website full-stack “Gabriele & Giulia”
dal commit locale `30582ba`, senza rifare i Task 1–4 e senza dichiarare completi
test PostgreSQL non realmente eseguiti.

## Documenti da leggere prima di modificare codice

1. Le istruzioni `AGENTS.md` fornite nel contesto del progetto.
2. `docs/superpowers/specs/2026-08-19-wedding-platform-design.md`.
3. `docs/superpowers/plans/2026-08-19-wedding-platform.md`.
4. `PLAN.md`.
5. Questo file.

## Stato Git e consegne completate

- Branch corrente: `main`.
- HEAD atteso prima del commit documentale: `30582ba`.
- Task 1: dominio/configurazione — review PASS.
- Task 2: Drizzle, AES-GCM, rate limit e transazioni — review PASS.
- Task 3: sito pubblico e design system — review PASS.
- Task 4: API reserve/contribute, Turnstile, bearer guest, email e form —
  security review PASS.
- Task 5: Auth.js (email + password), CLI e admin implementati, ma review non ancora PASS.

Non fare push, deploy, provisioning Vercel o modifiche DNS senza autorizzazione
esplicita.

## Task 5 fix round 4 — COMPLETATO (review PASS)

Tutti e quattro i finding chiusi con TDD; code + security review scoped PASS
(0 CRITICAL/HIGH). Gate: 221 unit, typecheck, ESLint, Prettier, `drizzle-kit
check`, build. Integration **eseguiti davvero**: 30/30 verdi.

### Come eseguire davvero i test di integrazione (PostgreSQL effimero locale)

Non serve Docker; usare i binari Homebrew `postgresql@15`:

```bash
export LC_ALL=C LANG=C
PGBIN=/opt/homebrew/opt/postgresql@15/bin
PGDATA="$SCRATCH/pgdata"; SOCK=/tmp/wpg   # socket corto: il path lungo supera 103 byte
"$PGBIN/initdb" -D "$PGDATA" -U wedding --auth=trust --locale=C -E UTF8
mkdir -p "$SOCK"
"$PGBIN/pg_ctl" -D "$PGDATA" -o "-p 54329 -k $SOCK -c listen_addresses=127.0.0.1" -w start
"$PGBIN/createdb" -h 127.0.0.1 -p 54329 -U wedding wedding_test
export TEST_DATABASE_URL='postgres://wedding@127.0.0.1:54329/wedding_test'
node_modules/.bin/vitest run --config vitest.integration.config.ts
```

### Due bug di produzione scoperti e corretti (Task 2/4)

- `src/lib/security/rate-limit.ts`: `Date` grezzi nei frammenti `sql` →
  crash driver. Fix: ISO + `::timestamptz`.
- `src/db/transactions/gifts.ts` + `errors.ts`: codici errore letti sul wrapper
  invece che su `.cause`; ora `findPostgresError` risale la catena e seleziona
  un codice con forma SQLSTATE.

### Note differite a Task 6

- Story media: sostituire `next/image unoptimized` con `remotePatterns` per
  l'host Vercel Blob e abilitare l'ottimizzazione.
- Salvare in `media_assets.pathname` una URL risolvibile (https) o path
  root-relative, altrimenti `isSafeMediaUrl` scarta il media pubblico.

## Archivio: dettaglio dei quattro finding chiusi

Usare TDD: aggiungere il test, osservarlo fallire per il motivo atteso,
implementare il minimo, rieseguire test mirati e suite completa.

### 1. Story media end-to-end

- In `src/actions/admin/content.ts`, quando `mediaAssetId` è fornito, verificare
  nella stessa transazione che `media_assets.id` esista e non sia archiviato.
- In `src/lib/public-content/adapter.ts`, non perdere l'associazione: includere
  URL, alt text e focal point nel modello pubblico della storia.
- Rendere il media nella timeline pubblica con `next/image`, dimensioni note e
  fallback elegante.
- Testare asset valido, UUID inesistente e asset archiviato.

### 2. Autenticazione admin email + password

- Login via Auth.js Credentials con verifica della password Argon2id e sessione
  server-side; nessun fattore aggiuntivo richiesto.
- Reset password da CLI (`pnpm admin:reset-password`) senza toccare gli altri
  account; le password sono sempre salvate come hash Argon2id.
- Aggiungere test su login valido/non valido, sessione e reset password.

### 3. Validazione datetime Europe/Rome

- `parseRomeLocalDateTime` può lanciare per input invalido o gap DST e oggi è
  invocato in una transform Zod.
- Trasformare l'errore in una issue Zod o validare con `superRefine`, affinché
  `safeParse` ritorni failure e la Server Action risponda “Evento non valido”.
- Conservare i test winter/summer/gap/overlap già presenti e aggiungere il test
  sulla action esportata.

### 4. Email outbox

- Le chiavi delivery devono includere almeno `intentId`, action e admin
  idempotency key. Sul conflict recovery verificare che delivery e intent
  coincidano; mai riutilizzare la delivery di un altro intento.
- Aggiungere un'azione owner-only idempotente “Invia email in attesa” che legga
  un batch limitato di `email_deliveries` pending/failed e lo processi usando la
  stessa provider idempotency key stabile.
- Esporre il controllo in `/admin/richieste` e registrare audit minimizzato.
- Resend resta opzionale; assenza provider non deve rollbackare le mutation.

### Gate Task 5

Eseguire:

```bash
~/Library/pnpm/pnpm test
~/Library/pnpm/pnpm typecheck
~/Library/pnpm/pnpm lint
~/Library/pnpm/pnpm format:check
DATABASE_URL='postgres://placeholder:placeholder@localhost:5432/placeholder' \
  ~/Library/pnpm/pnpm db:check
~/Library/pnpm/pnpm build
```

Se `TEST_DATABASE_URL` è disponibile, eseguire anche:

```bash
~/Library/pnpm/pnpm test:integration
```

Se non è disponibile, riportare esattamente i test skipped; non definirli
“passati”. Richiedere una code/security review scoped del diff Task 5 e chiudere
tutti i finding Important prima di iniziare Task 6.

## Task 6 — COMPLETATO

Consegnato:

- Upload Blob admin autorizzato (`/api/admin/media/upload`, `handleUpload`) con
  allowlist MIME/dimensione (niente SVG), policy testata; pathname = URL https.
- CSP e security header in `next.config.ts` (niente `unsafe-eval`; Turnstile e
  Blob con scope; HSTS, nosniff, frame DENY, referrer/permissions policy).
- SEO: `robots.ts` (Disallow: / in fase noindex), `sitemap.ts`, `manifest.ts`,
  OG/canonical, favicon; admin resta noindex. Health/readiness `/api/health`.
- Env di produzione fail-closed (`src/lib/config/env.ts`) verificate al boot da
  `instrumentation.ts`. `.env.example` completo. Scan segreti/PII: pulito.

Note (non automatizzato, per scelta/tempo):

- Privacy: pagina + gate `privacyReviewed` già presenti; la retention/
  anonimizzazione è **manuale guidata** e documentata in
  `docs/PRODUCTION_CHECKLIST.md`, non è tooling automatico.
- `delete/replace` media: l'archiviazione metadata esiste; la `del()` del blob
  fisico non è ancora cablata.
- CSP mantiene `unsafe-inline` (hydration Next); nonce-based CSP è un hardening
  successivo.

## Task 7 — COMPLETATO (con perimetro E2E esplicito)

Consegnato e verificato:

- `scripts/migrate.ts` + `scripts/seed.ts` (idempotente, dev/test only, rifiuta
  produzione). CLI admin ora **operative**: `--conditions=react-server` (stub di
  `server-only`) + `closeDatabase()` per l'uscita pulita; verificato
  create+list. Corepack pnpm resta guasto: usare `node_modules/.bin`.
- Playwright + axe: **12/12 verdi** contro un server reale sul DB seedato — home
  (h1 unico, skip-link, tastiera, a11y), registry (filtri toggle, dialog modale
  con focus-trap/restore, a11y con dialog aperto), pagine pubbliche (privacy
  a11y, token invitato invalido → risposta controllata), admin (login, guardia
  dashboard non autenticata), robots, health. Gli scan axe azzerano le
  transizioni CSS per misurare lo stato assestato.
- **A11y fix** emerso dagli E2E: widget Turnstile → `role="group"` (prima
  `aria-label` su `div` senza ruolo, violazione `aria-prohibited-attr`). Unit
  test aggiunto. La “bassa contrast” della nav era un frame di transizione: da
  assestata è `#14231d` su chiaro (~15:1).
- Screenshot QA a 390×844, 768×1024, 1440×900 **+ admin login + dialog
  contributo** con guardia anti-overflow; ispezione visiva OK (`artifacts/`,
  git-ignored).
- README, AGENTS, checklist di produzione.

Perimetro non coperto (onesto, per il prossimo giro se richiesto):

- E2E di **submission** reserve/contribute end-to-end non coperti: richiedono un
  token Turnstile (obbligatorio in produzione). Le gare di concorrenza sono
  comunque coperte dai test di **integration** su PostgreSQL reale.

Gate finale eseguito davvero: lint, typecheck, unit (230), integration (30/30 su
PostgreSQL reale), E2E (7/7), build, `drizzle-kit check`, scan segreti.

## Vincoli da non regredire

- Nessun dato demo o finta persistenza in production.
- IBAN solo dopo mutation nuova accettata, one-shot, `no-store`, mai su replay.
- Token guest casuale, hash-only; idempotency payload-bound.
- Lock scaduti restano bloccanti fino a intervento admin manuale.
- Importi esclusivamente in centesimi interi.
- Nessuna mutation admin senza session/role check server-side.
- Effect, audit e receipt DB nella stessa transazione.
- Production richiede trusted Vercel/proxy client identity; fail closed altrimenti.
- WCAG 2.2 AA, focus restore, reduced motion e nessun overflow a 320 px.
