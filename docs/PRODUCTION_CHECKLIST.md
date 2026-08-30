# Checklist di produzione

Da completare prima del go-live. Nessuno di questi passi viene eseguito
automaticamente da questa repository.

## Configurazione

- [ ] Tutte le variabili obbligatorie impostate nel provider (vedi
      `.env.example`); il boot fallisce se ne manca una.
- [ ] Segreti generati con `openssl rand` e **mai** committati.
- [ ] `DATABASE_URL` con SSL; connessione verificata da `/api/health` (200).
- [ ] `NEXT_PUBLIC_SITE_URL` = dominio pubblico reale (canonical, OG, origin).

## Database e contenuti

- [ ] `pnpm db:migrate` eseguito sul database di produzione.
- [ ] **Nessun** `pnpm db:seed` in produzione (rifiutato per NODE_ENV).
- [ ] Almeno un amministratore `owner` creato con `pnpm admin:create`.
- [ ] Istruzioni bancarie inserite dall'area admin (cifrate), non da seed.
- [ ] Contenuti hero/matrimonio/programma/storia/dress code/regali pubblicati e
      media richiesti caricati; modello privacy revisionato.

## Sicurezza

- [ ] Password admin robuste (Argon2id) per tutti gli account.
- [ ] CSP e header di sicurezza verificati in produzione (niente `unsafe-eval`).
- [ ] Turnstile configurato (site key + secret + hostname atteso).
- [ ] Identità client fidata dietro proxy (`TRUSTED_PROXY_IP_HEADER`).
- [ ] Scansione segreti/PII su repo e bundle client: nessuna perdita.

## Qualità

- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` verdi.
- [ ] `pnpm db:check` verde.
- [ ] Integration test eseguiti contro un PostgreSQL reale (30/30).
- [ ] E2E Playwright + axe verdi; QA visuale a 390/768/1440 senza overflow.

## SEO e go-live

- [ ] Il sito parte `noindex, nofollow` (robots `Disallow: /`). Quando si apre al
      pubblico: rimuovere il `noindex` nel layout e aggiornare `robots.ts`.
- [ ] Favicon, manifest e Open Graph verificati.

## Post-deploy

- [ ] Verifica manuale dei flussi critici: prenotazione, contributo, dichiarazione
      completamento, annullamento, verifica admin, invio email in attesa.
- [ ] Retention: pianificare l'anonimizzazione manuale guidata (invitati 12 mesi
      dopo il matrimonio; audit 24 mesi).
