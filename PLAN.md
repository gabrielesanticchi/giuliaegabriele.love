# Piano di realizzazione — stato al 19 agosto 2026

## Stato sintetico

| Milestone | Stato | Evidenza principale |
|---|---|---|
| 1. Fondazione, qualità e dominio | Completata | Commit `7b9414c`, `da93517`; review PASS |
| 2. PostgreSQL, cifratura e transazioni Lista Nozze | Completata | Commit `dd3d929` → `0ce1834`; review PASS |
| 3. Sistema grafico e sito pubblico | Completata | Commit `76e74b9` → `04f04e1`; review PASS |
| 4. API pubbliche e pagina invitato | Completata | Commit `cde0076` → `892b7a4`; security review PASS |
| 5. Auth.js, TOTP e amministrazione | In corso | Commit `06cf013` → `30582ba`; 4 finding residui |
| 6. Blob, privacy, SEO e hardening finale | Da iniziare | Task 6 del piano esecutivo |
| 7. E2E, QA visuale e documentazione | Da iniziare | Task 7 del piano esecutivo |

## Baseline corrente

- `HEAD`: `30582ba` (`fix: close admin concurrency and editor gaps`).
- Ultimo gate riportato dall'implementer: 208/208 unit test, typecheck, ESLint,
  Prettier, Drizzle e build Next.js superati.
- 22 test PostgreSQL sono definiti ma non eseguiti perché
  `TEST_DATABASE_URL` non è configurata.
- Il comando `pnpm` risolto tramite Corepack è guasto nell'ambiente corrente;
  usare `~/Library/pnpm/pnpm` oppure i binari in `node_modules/.bin`.
- Nessun deploy, push, provisioning Vercel o modifica DNS è stato eseguito.

## Prossimo lavoro obbligatorio

Completare il fix round 4 di Task 5 prima di iniziare Task 6:

1. Validare che il media di una storia esista e non sia archiviato; includere
   URL, alt e focal point nell'adapter pubblico e nella resa della timeline.
2. Rendere riprendibile l'onboarding TOTP pending dopo perdita della risposta:
   un nuovo `begin` per account non ancora abilitato deve restituire il QR del
   secret pending e rigenerare atomicamente recovery code, oppure effettuare un
   restart autenticato e auditato.
3. Impedire che date `datetime-local` invalide o nel gap DST lancino eccezioni
   fuori da Zod; devono produrre il normale risultato “Evento non valido”.
4. Rendere la chiave email delivery univoca anche per `intentId`, verificare
   l'identità sul conflict recovery e aggiungere un'azione owner-only per
   processare/reinviare le delivery pending con idempotency provider stabile.
5. Rieseguire review scoped di Task 5 e correggere eventuali regressioni.

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
