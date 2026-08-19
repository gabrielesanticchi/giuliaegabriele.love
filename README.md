# Gabriele & Giulia — sito del matrimonio

Applicazione Next.js full-stack per il matrimonio di Gabriele e Giulia
(24 ottobre 2026, fuso `Europe/Rome`). Include un sito pubblico editoriale, una
Lista Nozze transazionale **senza pagamenti online** e un'area amministrativa
protetta da password + TOTP.

Interfaccia e contenuti sono in italiano. Il progetto è pensato per il deploy su
Vercel, ma **questa repository non esegue deploy, push o provisioning**.

## Stack

- **Next.js 16** (App Router, React 19, TypeScript strict)
- **PostgreSQL** via **Drizzle ORM** + driver `postgres`
- **Auth.js (next-auth)** Credentials + **TOTP** (otplib) e Argon2id
- **Zod** per la validazione, **React Hook Form** per i form
- **Vercel Blob** per i media, **Resend** per le email (opzionale)
- **Cloudflare Turnstile** anti-abuso sui form pubblici
- **Vitest** + Testing Library (unit/integration), **Playwright** + axe (E2E/a11y)
- **Tailwind CSS v4** e sistema grafico originale “Bosco Incantato Editoriale”

## Requisiti

- Node.js ≥ 20.9
- pnpm 11 (in questo ambiente Corepack è guasto: usare `~/Library/pnpm/pnpm`
  oppure i binari in `node_modules/.bin`)
- Un database PostgreSQL

## Setup

```bash
pnpm install
cp .env.example .env.local   # compila i valori (vedi sotto)
pnpm db:migrate              # applica le migrazioni Drizzle
pnpm db:seed                 # (solo dev/test) contenuti dimostrativi idempotenti
pnpm admin:create --email tu@example.com --role owner --password-stdin
pnpm dev
```

Il primo accesso admin richiede la configurazione TOTP; se perdi il QR o i
recovery code puoi ripartire in sicurezza dal pulsante **“Ricomincia la
configurazione”** (non tocca mai le credenziali di un account già abilitato).

## Variabili d'ambiente

Vedi [`.env.example`](./.env.example) per l'elenco commentato. In **produzione**
le variabili obbligatorie sono verificate al boot (`instrumentation.ts`): se ne
manca una l'app **non si avvia** (fail-closed). Obbligatorie:

`DATABASE_URL`, `AUTH_SECRET`, `AUTH_HMAC_PEPPER`, `AUTH_ENCRYPTION_KEY`,
`AUTH_RECOVERY_PEPPER`, `DATA_ENCRYPTION_KEY`, `GUEST_TOKEN_SECRET`,
`REQUEST_FINGERPRINT_SECRET`, `NEXT_PUBLIC_SITE_URL`.

Opzionali: `BLOB_READ_WRITE_TOKEN`, Turnstile (`*_TURNSTILE_*`), Resend
(`RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_NOTIFICATION_EMAIL`). Se Resend non è
configurato le email vengono registrate come `skipped` e **nessuna transazione
viene annullata**.

## Script

| Comando                                                     | Descrizione                                                |
| ----------------------------------------------------------- | ---------------------------------------------------------- |
| `pnpm dev` / `pnpm build` / `pnpm start`                    | Sviluppo / build / avvio produzione                        |
| `pnpm lint` · `pnpm typecheck`                              | ESLint · TypeScript                                        |
| `pnpm format` · `pnpm format:check`                         | Prettier                                                   |
| `pnpm test`                                                 | Unit test (Vitest, jsdom)                                  |
| `pnpm test:integration`                                     | Integration test PostgreSQL (richiede `TEST_DATABASE_URL`) |
| `pnpm test:e2e`                                             | Playwright (richiede un server e browser installati)       |
| `pnpm db:migrate` · `pnpm db:seed`                          | Migrazioni · seed demo (dev/test)                          |
| `pnpm db:check` · `pnpm db:generate`                        | Verifica/genera migrazioni Drizzle                         |
| `pnpm admin:create` · `admin:list` · `admin:reset-password` | CLI amministratori                                         |

## Test

- **Unit**: `pnpm test`.
- **Integration** (concorrenza, transazioni, outbox, TOTP): serve un PostgreSQL
  reale. Esempio con un cluster effimero locale (senza Docker):

  ```bash
  export LC_ALL=C LANG=C
  PGBIN=/opt/homebrew/opt/postgresql@15/bin
  "$PGBIN/initdb" -D .pgdata -U wedding --auth=trust --locale=C -E UTF8
  mkdir -p /tmp/wpg   # socket corto: il path lungo supera i 103 byte
  "$PGBIN/pg_ctl" -D .pgdata -o "-p 54329 -k /tmp/wpg -c listen_addresses=127.0.0.1" -w start
  "$PGBIN/createdb" -h 127.0.0.1 -p 54329 -U wedding wedding_test
  export TEST_DATABASE_URL='postgres://wedding@127.0.0.1:54329/wedding_test'
  pnpm test:integration
  ```

- **E2E/accessibilità**: `pnpm test:e2e` (Playwright + axe). Se il browser
  pinnato non è disponibile ma ne hai uno compatibile, imposta
  `PLAYWRIGHT_CHROMIUM_PATH`. Screenshot QA (390/768/1440) con
  `CAPTURE_SCREENSHOTS=1` in `artifacts/screenshots/`.

## Architettura

- `src/app/(public)` — homepage editoriale, privacy, pagina personale invitato.
- `src/app/admin` — login, onboarding TOTP, dashboard e CRUD.
- `src/app/api` — auth, health, reserve/contribute, gestione richiesta, upload.
- `src/db` — schema Drizzle, query e transazioni (`reserveGift`,
  `contributeToGift`, `verifyIntent`, …).
- `src/lib` — configurazione, crittografia AES-256-GCM, auth, rate limiting,
  email, Blob, validazione, adapter contenuti pubblici.
- `src/components` — sistema visivo, sezioni pubbliche, UI admin.

## Sicurezza (in breve)

- Dati bancari e dettagli invitato cifrati AES-256-GCM; mai in seed, bundle, log
  o risposte GET pubbliche.
- IBAN restituito **solo** nella risposta della mutation appena accettata, con
  `Cache-Control: no-store`, mai su replay.
- Token invitato casuale e salvato solo come hash; idempotenza legata al payload.
- CSP senza `unsafe-eval`, HSTS e header di sicurezza in `next.config.ts`.
- Ogni mutation admin verifica sessione e ruolo lato server; effect, audit e
  receipt nella stessa transazione.

Vedi [`docs/PRODUCTION_CHECKLIST.md`](./docs/PRODUCTION_CHECKLIST.md) prima del
go-live.
