# Stato del progetto — 6 settembre 2026

## Architettura corrente

- Hero, data, luoghi, indicazioni e storia sono versionati in
  `src/data/site-content.ts`.
- PostgreSQL conserva soltanto Lista Nozze, richieste, coordinate bancarie,
  amministratori, audit, idempotenza, rate limiting ed email.
- Il sito pubblico non ha un gate di pubblicazione e resta visibile anche se il
  caricamento dei regali fallisce.
- L’admin espone Panoramica, Lista Nozze, Richieste e Impostazioni.
- Non esistono CMS editoriale, preview, upload media, Turnstile o contenuti demo.

## Migrazione pendente

Le migrazioni `drizzle/0004_sweet_quasimodo.sql` e
`drizzle/0005_vengeful_spencer_smythe.sql` eliminano definitivamente
`media_assets`, `story_moments`, `gifts.media_asset_id` e il vecchio selettore
`gifts.progress_mode`. La perdita dei vecchi dati editoriali è stata approvata
esplicitamente; le migrazioni non sono state eseguite su Vercel.

## Verifica

Il gate richiesto è:

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration  # richiede TEST_DATABASE_URL
pnpm db:check
pnpm build
```

Specifica e piano dettagliato:

- `docs/superpowers/specs/2026-09-05-static-wedding-content-design.md`
- `docs/superpowers/plans/2026-09-05-static-wedding-content.md`
