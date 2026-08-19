# Wedding Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Costruire il wedding website full-stack production-ready di Gabriele e Giulia con Lista Nozze e amministrazione.

**Architecture:** Monolite Next.js App Router con contenuti server-rendered, PostgreSQL/Drizzle per persistenza e transazioni, Auth.js Credentials + TOTP per admin e servizi server-only per dati sensibili. La modalità demo è un adapter esclusivamente development/test.

**Tech Stack:** Next.js, React, TypeScript strict, Tailwind CSS, Drizzle/PostgreSQL, Auth.js, Zod, React Hook Form, Radix UI, Vercel Blob, Resend, Vitest, Testing Library, Playwright, axe-core, pnpm.

**Spec:** `docs/superpowers/specs/2026-08-19-wedding-platform-design.md`

## Execution Status — 2026-08-19

- Task 1: **complete**, review PASS (`7b9414c`, `da93517`).
- Task 2: **complete**, review PASS (`dd3d929`, `aa16330`, `0ce1834`).
- Task 3: **complete**, review PASS (`76e74b9`, `92469c5`, `0a1e552`, `04f04e1`).
- Task 4: **complete**, security review PASS (`cde0076`, `44eaf04`, `da18e59`, `a8cc59d`, `892b7a4`).
- Task 5: **complete**. Fix round 4 landed all four residual findings; scoped
  code + security review PASS (0 CRITICAL/HIGH; MEDIUM items resolved or
  documented).
- Task 6: **in progress**.
- Task 7: **pending**.

Latest verification (fix round 4): 221 unit tests passed; typecheck, ESLint,
Prettier, `drizzle-kit check` and Next production build passed. The PostgreSQL
integration suite was **executed for real** against an ephemeral local
PostgreSQL 15 cluster and is 30/30 green (22 pre-existing + 8 new). Running it
surfaced and fixed two latent production bugs in Task 2/4 code (rate-limit
`Date`-in-SQL crash; drizzle `.cause`-chain error unwrap) — see `PLAN.md`.

## Global Constraints

- Interfaccia e documentazione in italiano; timezone `Europe/Rome`.
- Importi sempre in centesimi interi; nessun pagamento sul sito.
- Production non usa demo, JSON o filesystem per persistenza.
- Nessun segreto, IBAN reale o password nel repository o nei log.
- WCAG 2.2 AA sostanziale e `prefers-reduced-motion`.
- Nessun push, deploy o provisioning cloud.

---

### Task 1: Fondazione e contratti di dominio

**Status:** COMPLETE — reviewed.

**Files:** `package.json`, configurazioni TypeScript/Next/Tailwind/Vitest/Playwright, `src/lib/domain/*`, `tests/unit/*`.

**Interfaces:** Produce `formatCurrency`, `getCountdown`, `getPublicGiftStatus`, `getGiftFunding`, `buildTransferReason`, schemi Zod e tipi condivisi.

- [ ] Scrivere test fallenti con valori letterali per valuta, countdown, stati, residui, causale, URL ed email.
- [ ] Eseguire Vitest e verificare fallimenti per moduli mancanti.
- [ ] Implementare le funzioni pure minime e gli schemi.
- [ ] Rieseguire test, typecheck e lint.

### Task 2: Database e sicurezza server-only

**Status:** COMPLETE — reviewed.

**Files:** `src/db/schema/*`, `src/db/index.ts`, `src/db/transactions/*`, `src/lib/security/*`, `drizzle.config.ts`, migrazioni, test unitari e integrazione.

**Interfaces:** Produce schema Drizzle, `reserveGift`, `contributeToGift`, `verifyIntent`, `cancelIntent`, `encryptSecret`, `decryptSecret`, rate limiter e token hash.

- [ ] Scrivere test fallenti per cifratura/tamper, idempotenza e transazioni concorrenti.
- [ ] Generare schema con FK, unique/check constraint e indici.
- [ ] Implementare transazioni atomiche e mapping errori `409`.
- [ ] Verificare unit test; eseguire integrazione reale soltanto con `TEST_DATABASE_URL`.

### Task 3: Sistema grafico e sito pubblico

**Status:** COMPLETE — reviewed.

**Files:** `src/app/(public)/*`, `src/components/layout/*`, `src/components/sections/*`, `src/components/graphics/*`, `src/data/demo-content.ts`, `public/graphics/*`.

**Interfaces:** Consuma query contenuti/regali; produce homepage semantica, privacy e pagina di attesa.

- [ ] Scrivere test componenti fallenti per landmark, data, fallback, stati e CTA.
- [ ] Implementare token, font, monogramma, header, hero/countdown e sezioni editoriali.
- [ ] Implementare Lista Nozze, filtri e dialog accessibili.
- [ ] Verificare componenti, responsive e reduced motion.

### Task 4: API pubbliche e pagina invitato

**Status:** COMPLETE — reviewed.

**Files:** `src/app/api/gifts/*`, `src/app/api/requests/*`, `src/app/richiesta/*`, `src/lib/turnstile/*`, `src/lib/email/*`.

**Interfaces:** Consuma transazioni; produce risposte tipizzate, istruzioni una tantum, link personale e notifiche opzionali.

- [ ] Scrivere test route fallenti per validation, origin, honeypot, idempotenza, rate limit, `409` e `no-store`.
- [ ] Implementare pipeline di sicurezza e route reserve/contribute.
- [ ] Implementare dichiarazione completamento e annullamento atomico.
- [ ] Verificare che GET, HTML iniziale e log non contengano dati bancari.

### Task 5: Autenticazione e amministrazione

**Status:** COMPLETE — fix round 4 closed the four residuals; code + security
review PASS. See `docs/HANDOFF_CLAUDE.md` for the deferred Task 6 notes.

**Files:** `auth.ts`, `proxy.ts`, `src/app/admin/*`, `src/actions/admin/*`, `src/components/admin/*`, `scripts/admin-*`.

**Interfaces:** Produce login Auth.js, onboarding TOTP, CLI amministratori, dashboard e CRUD strutturati.

- [ ] Scrivere test fallenti per password, TOTP, autorizzazione e azioni idempotenti.
- [ ] Implementare sessioni, CLI e protezione di tutte le boundary admin.
- [ ] Implementare dashboard, contenuti, programma, storia, dress code, regali, richieste, media, impostazioni e audit.
- [ ] Implementare draft/preview/publish, readiness gate, CSV sicuro e inserimenti manuali.

### Task 6: Blob, privacy, SEO e hardening

**Status:** PENDING.

**Files:** `src/lib/blob/*`, upload route, `src/app/(public)/privacy/page.tsx`, metadata/robots/sitemap/manifest/OG, `next.config.ts`, `.env.example`.

**Interfaces:** Produce upload autenticato allowlist, policy bozza, header CSP e configurazione validata.

- [ ] Scrivere test fallenti per MIME/dimensioni, env, protocol allowlist e CSV injection.
- [ ] Implementare upload diretto autorizzato e metadati.
- [ ] Implementare privacy/retention, SEO/noindex, health/readiness e security header.
- [ ] Verificare assenza secret con scansione repository e build client.

### Task 7: E2E, QA visuale e documentazione

**Status:** PENDING.

**Files:** `tests/e2e/*`, `README.md`, `AGENTS.md`, script DB/seed, screenshot in `artifacts/` ignorati da Git.

**Interfaces:** Verifica il sistema completo e documenta l'operatività.

- [ ] Implementare fixture demo/test e percorsi Playwright pubblici/admin/accessibilità.
- [ ] Eseguire lint, typecheck, unit, integrazione disponibile, E2E e build.
- [ ] Generare e ispezionare screenshot 390×844, 768×1024 e 1440×900; correggere regressioni.
- [ ] Scrivere README italiano, AGENTS conciso e checklist production; rieseguire `pnpm check`.
