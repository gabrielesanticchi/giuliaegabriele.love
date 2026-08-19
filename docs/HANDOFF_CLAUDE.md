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
- Task 5: Auth.js, TOTP, CLI e admin implementati, ma review non ancora PASS.

Non fare push, deploy, provisioning Vercel o modifiche DNS senza autorizzazione
esplicita.

## Task immediato: chiudere Task 5, fix round 4

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

### 2. Onboarding TOTP pending recuperabile

- `beginTotpEnrollmentAction` è già serializzato e auditato, ma oggi rifiuta un
  secondo begin quando esiste un pending; una risposta HTTP persa può bloccare
  per sempre l'account.
- Per un account `totpEnabled=false`, consentire la ripresa sicura: decifrare il
  secret pending per rigenerare il QR e sostituire atomicamente i recovery hash
  con nuovi codici plaintext restituiti una sola volta; in alternativa fare un
  restart autenticato, serializzato e auditato.
- Non modificare mai il secret/recovery attivo di un account già abilitato.
- Aggiungere test concorrenti e test “lost response → begin again → complete”.

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

## Task 6 — pending

- Vercel Blob upload admin con MIME/dimension limits, direct upload autorizzato,
  metadata, retry, delete/replace e nessun SVG non fidato.
- Privacy/retention/anonimizzazione, bozza non pubblicabile e checklist.
- Metadata API, canonical, OG, favicon, manifest, robots/sitemap, noindex admin.
- CSP e security header compatibili con Blob/Turnstile; niente `unsafe-eval`.
- Health/readiness e `.env.example` validato; production fail-closed.
- Scansione bundle/repository per segreti e PII.

## Task 7 — pending

- Script migrate/seed/admin operativi e seed demo idempotente solo dev/test.
- Playwright per i 20 flussi del brief, axe e race test con PostgreSQL reale.
- Screenshot/QA visuale a 390×844, 768×1024 e 1440×900, inclusi admin e modali.
- README italiano completo, `AGENTS.md` conciso e checklist production.
- Gate finale fresco: lint, typecheck, unit, integration, E2E, build e scan secret.

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
