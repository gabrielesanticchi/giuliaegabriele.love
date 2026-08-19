# Wedding Platform Design

## Obiettivo

Realizzare un'unica applicazione Next.js full-stack per il matrimonio di Gabriele e Giulia, in italiano, pronta per Vercel, con sito pubblico editoriale, Lista Nozze transazionale senza pagamenti online e area amministrativa protetta.

## Decisioni confermate

- Data: 24 ottobre 2026, ore 11:00, fuso `Europe/Rome`.
- Cerimonia: Chiesa San Giovanni Bosco, Caleppio di Settala. Finché l'indirizzo non è verificato si pubblica soltanto il nome e un link Maps basato sulla denominazione.
- Ricevimento: Villa Cavenago, Via Giuseppe Carcassola 15, Trezzo sull'Adda, fino alle 23:00.
- Sito pubblico senza password, inizialmente `noindex, nofollow`; nessun RSVP.
- Modalità discreta per il progresso dei contributi, configurabile per regalo.
- Prenotazioni e contributi impegnano importi per 48 ore e restano bloccanti finché un amministratore non interviene.
- Gli invitati ricevono un link personale revocabile; possono dichiarare il completamento o annullare una richiesta pending.
- Resend è opzionale. Nessun cron o promemoria automatico nella prima versione.
- Dati bancari cifrati AES-256-GCM, mai inseriti in seed, bundle, log o GET pubbliche.
- TOTP obbligatorio per gli amministratori in production; nessuna registrazione pubblica.
- Production non espone contenuti demo e mostra una pagina di attesa finché la checklist non è completa e il sito non viene pubblicato esplicitamente.
- Nessun deploy, push, provisioning cloud o modifica DNS durante questa esecuzione.

## Architettura

Next.js App Router usa Server Components per contenuti e dashboard, Client Components soltanto per navigazione, countdown, filtri, dialog e form. Drizzle accede a PostgreSQL tramite `postgres`, con transazioni e vincoli univoci per lock e idempotenza. Auth.js Credentials gestisce sessioni amministrative; password Argon2id e TOTP proteggono l'accesso. Vercel Blob è astratto dietro un servizio server-only. Le integrazioni Turnstile e Resend degradano in modo controllato quando non configurate in development, mai simulando persistenza in production.

## Moduli

- `src/app/(public)`: homepage one-page, privacy e pagina personale invitato.
- `src/app/admin`: login, onboarding TOTP, dashboard e CRUD editoriali/transazionali.
- `src/app/api`: autenticazione, health, reserve/contribute, gestione richiesta e upload.
- `src/db`: schema Drizzle, query e transazioni.
- `src/lib`: configurazione, crittografia, auth, rate limiting, email, Blob e validazione.
- `src/components`: sistema visivo originale “Bosco Incantato Editoriale”, sezioni pubbliche e UI admin.
- `src/data/demo-content.ts`: contenuti locali esclusivamente development/test.

## Flussi critici

La prenotazione crea intenzione e lock nello stesso commit; la unique key su `gift_locks.gift_id` trasforma la contesa in `409`. Un contributo blocca coerentemente il regalo, somma verified e pending attivi e rifiuta atomicamente importi oltre il residuo. Le mutation restituiscono istruzioni bancarie solo nella risposta appena accettata con `Cache-Control: no-store`. I token personali sono memorizzati come hash e revocati dopo 30 giorni dallo stato terminale.

## Dati e privacy

Gli importi sono centesimi interi. Gli IP non vengono persistiti: il rate limiter usa un fingerprint HMAC. Audit ed email delivery non contengono segreti o PII completa. La retention invitati è inizialmente 12 mesi dopo il matrimonio, con anonimizzazione manuale guidata; audit log 24 mesi. Il modello privacy resta bozza finché non viene esplicitamente verificato.

## Visual design e accessibilità

Palette foresta/avorio/argilla, Cormorant Garamond e Manrope tramite `next/font`, monogramma SVG originale con due G, texture carta e riferimenti topografici/architettonici. Un solo `h1`, skip link, focus visibile, target 44 px, dialog Radix, error summary, live region e pieno supporto `prefers-reduced-motion`. Gli asset demo sono SVG locali originali senza fotografie remote.

## Errori e resilienza

Le route pubbliche applicano content-type/origin/body limit, Zod, honeypot, Turnstile, idempotenza e rate limiting PostgreSQL. Gli errori usano codici pubblici stabili senza dettagli interni. Se database o configurazione production non sono disponibili, l'app mostra indisponibilità controllata e non usa dati demo.

## Verifica

Vitest copre funzioni pure e sicurezza; test PostgreSQL reali coprono concorrenza quando `TEST_DATABASE_URL` è presente; Playwright copre flussi pubblici/admin, tastiera, responsive e axe. La consegna richiede lint, typecheck, unit test, build e QA visiva a 390, 768 e 1440 px; ogni controllo non eseguibile viene riportato esplicitamente.

