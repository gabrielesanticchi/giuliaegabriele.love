# Stato del repository — 9 settembre 2026

Questo documento è uno snapshot dell’architettura attiva. Non contiene backlog
storici o migrazioni future ipotetiche.

## Stato funzionale

- Il sito è pubblico per impostazione predefinita; non esiste un gate editoriale
  di pubblicazione.
- `/` mostra hero, conto alla rovescia, cerimonia, storia e Lista Nozze, senza
  dettagli del ricevimento.
- `/ricevimento` riusa gli stessi componenti e aggiunge Villa Cavenago; la route
  è accessibile tramite link, `noindex, nofollow`, assente da sitemap e
  navigazione.
- La policy di lancio globale è `noindex, nofollow` e `robots.txt` disabilita la
  scansione dell’intero sito.
- `/richiesta/[token]` permette all’ospite di consultare e aggiornare soltanto
  la propria richiesta.
- I contenuti del matrimonio sono versionati in `src/data/site-content.ts`.
- Regali, categorie, richieste, lock, coordinate bancarie, audit, idempotenza,
  rate limiting ed email sono in PostgreSQL.
- La Lista Nozze usa prezzi di listino in centesimi, immagini locali e link
  prodotto HTTPS.
- “Regala” è nascosto appena esiste un contributo verificato sul regalo.

## Amministrazione

La navigazione attiva comprende esclusivamente:

1. Panoramica;
2. Lista nozze;
3. Richieste;
4. Impostazioni.

L’admin non modifica hero, storia, data o luoghi. Le coordinate bancarie restano
cifrate. Tutte le mutation sono autorizzate lato server e salvano effect, audit
e receipt idempotente nella stessa transazione.

## Schema dati

- Dieci tabelle PostgreSQL definite in `src/db/schema/tables.ts`.
- Quattro enum per tipo/metodo/stato delle richieste e stato email.
- Ultima migrazione richiesta dallo schema corrente:
  `drizzle/0006_gift_cents_and_media.sql`.
- Nessun layer di compatibilità per nomi di colonna precedenti.
- Modello dettagliato: `docs/DATA_MODEL.md`.

## Sicurezza operativa

- Produzione fail-closed sulle variabili critiche.
- Nessun pagamento online.
- Dati personali e bancari cifrati; token, email di lookup e fingerprint hashati.
- IBAN disponibile soltanto nella risposta `no-store` della mutation appena
  accettata, mai nelle GET o nei replay.
- Prenotazioni intere protette da lock esclusivo; durata predefinita 48 ore.
- Form pubblici protetti da origin check, honeypot, idempotenza e rate limiting
  PostgreSQL.

## Verifica corrente

Il gate applicativo è:

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Controlli aggiuntivi:

```text
pnpm format:check
pnpm db:check
pnpm test:integration  # richiede TEST_DATABASE_URL
pnpm test:e2e          # richiede server e browser
```

Le migrazioni non fanno parte di `next build`: ogni modifica incompatibile allo
schema richiede migrazione e deploy coordinati.

## Fonti autorevoli

- Architettura e uso: `README.md`.
- Schema e invarianti: `docs/DATA_MODEL.md`.
- Regole per agenti: `AGENTS.md`.
- Schema eseguibile: `src/db/schema/tables.ts`.
- Contenuto editoriale: `src/data/site-content.ts`.
