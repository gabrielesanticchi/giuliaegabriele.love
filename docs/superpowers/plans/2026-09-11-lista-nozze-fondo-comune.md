# Lista Nozze Fondo Comune Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separare le contribuzioni libere dai singoli regali, offrire acquisto esterno e bonifico intero per ogni oggetto, e aggiornare la gerarchia visiva della home.

**Architecture:** Le contribuzioni comuni sono `gift_intents` di tipo `contribution` con `gift_id = NULL`; le prenotazioni intere restano legate a un regalo e protette da lock. Un nuovo endpoint `/api/registry/contribute` gestisce il fondo comune, mentre la UI delle schede separa il semplice redirect esterno dal flusso transazionale del bonifico.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Drizzle/PostgreSQL, Radix Dialog, React Hook Form, Zod, Vitest, Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-11-lista-nozze-fondo-comune-design.md`

## Global Constraints

- Nessun pagamento online, deploy, provisioning cloud o applicazione di migrazioni remote.
- Nessun numero telefonico, IBAN reale o PII nel repository, nei log, nel bundle o nelle GET.
- IBAN soltanto nella prima risposta della mutation accettata, `no-store`, mai su replay.
- I regali interi mantengono lock esclusivo di 48 ore e idempotenza legata al payload.
- Ogni mutation admin conserva autorizzazione, effect, audit e receipt nella stessa transazione.
- Importi in centesimi interi; accessibilità WCAG 2.2 AA e nessun overflow a 320 px.
- Usare `~/Library/pnpm/pnpm`; non installare o aggiornare dipendenze.
- Per ogni comportamento: test fallente osservato, implementazione minima, test verde.

---

### Task 1: Modello dati del fondo comune

**Files:**
- Modify: `src/db/schema/tables.ts`
- Create: `drizzle/0007_registry_common_fund.sql`
- Modify: `drizzle/meta/_journal.json`
- Create: `drizzle/meta/0007_snapshot.json`
- Test: `tests/integration/schema-bootstrap.test.ts`

**Interfaces:**
- Produces: `giftIntents.giftId: string | null` e vincolo PostgreSQL `gift_intents_full_gift_requires_gift`.
- Migration behavior: ogni riga storica `kind = 'contribution'` riceve `gift_id = NULL` prima dell'aggiunta del vincolo.

- [ ] **Step 1: Scrivere il test di schema fallente**

```ts
expect(intentColumns).toContainEqual({
  column_name: "gift_id",
  is_nullable: "YES"
});
expect(fullGiftWithoutGift).rejects.toMatchObject({ code: "23514" });
```

- [ ] **Step 2: Eseguire il test e osservare il fallimento**

Run: `~/Library/pnpm/pnpm test:integration tests/integration/schema-bootstrap.test.ts`
Expected: FAIL se `TEST_DATABASE_URL` è disponibile; altrimenti registrare lo skip e usare `db:check` come verifica strutturale.

- [ ] **Step 3: Implementare schema e migrazione**

```ts
giftId: uuid("gift_id").references(() => gifts.id, { onDelete: "cascade" })
```

La migrazione esegue, in ordine, `DROP NOT NULL`, `UPDATE ... SET gift_id = NULL WHERE kind = 'contribution'`, quindi aggiunge:

```sql
CHECK (kind <> 'full_gift' OR gift_id IS NOT NULL)
```

- [ ] **Step 4: Generare metadata Drizzle e verificare**

Run: `~/Library/pnpm/pnpm db:generate`
Expected: migrazione e snapshot coerenti, senza modificare migrazioni precedenti.

Run: `~/Library/pnpm/pnpm db:check`
Expected: PASS.

- [ ] **Step 5: Commit del task**

```bash
git add src/db/schema/tables.ts drizzle tests/integration/schema-bootstrap.test.ts
git commit -m "feat: model registry contributions without gifts"
```

### Task 2: Transazione autonoma per le contribuzioni

**Files:**
- Modify: `src/db/transactions/gifts.ts`
- Modify: `src/db/transactions/index.ts`
- Modify: `src/db/transactions/policies.ts`
- Test: `tests/integration/gift-transactions.test.ts`
- Test: `tests/unit/transaction-policy.test.ts`

**Interfaces:**
- Produces: `declareRegistryContribution(db, input, callbacks)` con input uguale ai campi sensibili di `MutationInput` salvo `giftId`; restituisce `GiftMutationResult`.
- Consumes: idempotenza e callback `beforeCommit` già usate da `reserveGift`.

- [ ] **Step 1: Scrivere test fallenti per inserimento, replay e collisione**

```ts
const created = await declareRegistryContribution(db, input);
expect(created.replayed).toBe(false);
expect(saved).toMatchObject({
  giftId: null,
  kind: "contribution",
  method: "bank_transfer",
  amountCents: input.amountCents
});
```

Il secondo test riusa chiave e payload e attende `replayed: true`; il terzo riusa la chiave con importo diverso e attende `duplicate_request`.

- [ ] **Step 2: Eseguire i test e osservare l'assenza della funzione**

Run: `~/Library/pnpm/pnpm test tests/unit/transaction-policy.test.ts`
Expected: FAIL sul nuovo contratto.

- [ ] **Step 3: Implementare la transazione serializzabile minima**

```ts
await tx.insert(giftIntents).values({
  ...input,
  giftId: null,
  kind: "contribution",
  method: "bank_transfer",
  status: "pending"
});
```

Il fingerprint semantico del replay include target `registry_fund` e importo; nessun accesso a `gifts` o `giftLocks`.

- [ ] **Step 4: Eseguire unit e integration disponibili**

Run: `~/Library/pnpm/pnpm test tests/unit/transaction-policy.test.ts tests/unit/gift-transaction-callback.test.ts`
Expected: PASS.

Run: `~/Library/pnpm/pnpm test:integration tests/integration/gift-transactions.test.ts`
Expected: PASS oppure skip dichiarato senza un database reale.

- [ ] **Step 5: Commit del task**

```bash
git add src/db/transactions tests/unit/transaction-policy.test.ts tests/integration/gift-transactions.test.ts
git commit -m "feat: add common registry contribution transaction"
```

### Task 3: Endpoint pubblico del fondo comune

**Files:**
- Create: `src/app/api/registry/contribute/route.ts`
- Delete: `src/app/api/gifts/[giftId]/contribute/route.ts`
- Modify: `src/lib/public-api/gift-handler.ts`
- Modify: `src/lib/public-api/runtime-dependencies.ts`
- Modify: `src/lib/domain/references.ts`
- Test: `tests/unit/public-gift-route.test.ts`
- Test: `tests/unit/public-api-validation.test.ts`

**Interfaces:**
- Produces: `createRegistryContributionHandler(dependencies)` e `buildRegistryContributionReason(intentReference)`.
- Runtime dependency mutation chiama `declareRegistryContribution`; il gift virtuale per notifiche ha titolo “Fondo comune Lista Nozze” e riferimento `FONDO-CASA`.

- [ ] **Step 1: Scrivere i test fallenti dell'handler**

```ts
const response = await createRegistryContributionHandler(deps)(
  postContribution({ amountCents: 12500 })
);
expect(response.status).toBe(200);
expect(response.headers.get("cache-control")).toBe("no-store");
expect(mutationInput).toMatchObject({ amountCents: 12500 });
expect(mutationInput).not.toHaveProperty("giftId");
```

Copertura aggiuntiva: origin errata, honeypot, body oltre 16 KiB, rate limit, replay senza IBAN e causale `CASA-FONDOCASA-...`.

- [ ] **Step 2: Eseguire e osservare il fallimento**

Run: `~/Library/pnpm/pnpm test tests/unit/public-gift-route.test.ts`
Expected: FAIL perché handler e route non esistono.

- [ ] **Step 3: Separare handler comune e handler legato al regalo**

La validazione comune, cifratura, rate limit e risposta restano condivisi. Il nuovo handler non accetta un contesto `giftId`, usa sempre bonifico e passa l'importo validato alla mutation autonoma.

- [ ] **Step 4: Aggiungere la Route Handler Next.js**

```ts
export const runtime = "nodejs";
export async function POST(request: Request) {
  return createRegistryContributionHandler(
    createRegistryContributionRuntimeDependencies()
  )(request);
}
```

- [ ] **Step 5: Eseguire test e typecheck mirati**

Run: `~/Library/pnpm/pnpm test tests/unit/public-gift-route.test.ts tests/unit/public-api-validation.test.ts`
Expected: PASS.

Run: `~/Library/pnpm/pnpm typecheck`
Expected: PASS oppure errori reali da risolvere prima del task successivo.

- [ ] **Step 6: Commit del task**

```bash
git add src/app/api src/lib/public-api src/lib/domain/references.ts tests/unit
git commit -m "feat: expose common registry contribution endpoint"
```

### Task 4: Consumer backend nullable e verifica admin

**Files:**
- Modify: `src/actions/admin/requests.ts`
- Modify: `src/app/(public)/richiesta/[token]/data.ts`
- Modify: `src/app/admin/(panel)/[section]/page.tsx`
- Modify: `src/lib/email/index.ts`
- Modify: `src/lib/email/templates.ts`
- Modify: `src/lib/admin/csv.ts`
- Modify: `docs/DATA_MODEL.md`
- Modify: `PLAN.md`
- Test: `tests/unit/email.test.ts`
- Test: `tests/unit/guest-request-page.test.tsx`
- Test: `tests/unit/admin-ui.test.tsx`
- Test: `tests/integration/admin-idempotency.test.ts`

**Interfaces:**
- Consumes: `giftIntents.giftId: string | null`.
- Produces: fallback condiviso `Fondo comune Lista Nozze` in UI, email ed export; verifica contribution senza update di `gifts`.

- [ ] **Step 1: Scrivere test fallenti per i consumer nullable**

```ts
expect(snapshot?.giftTitle).toBe("Fondo comune Lista Nozze");
expect(email.text).toContain("destinato al Fondo comune Lista Nozze");
expect(email.text).not.toContain("associato a");
```

Il test admin verifica che una contribuzione `giftId: null` possa essere verificata e che nessun regalo venga modificato.

- [ ] **Step 2: Eseguire e osservare i fallimenti**

Run: `~/Library/pnpm/pnpm test tests/unit/email.test.ts tests/unit/guest-request-page.test.tsx tests/unit/admin-ui.test.tsx`
Expected: FAIL sui fallback e sul nuovo copy.

- [ ] **Step 3: Convertire inner join in left join e aggiungere fallback**

```ts
giftTitle: sql<string>`coalesce(${gifts.title}, 'Fondo comune Lista Nozze')`
```

La verifica admin esegue il ramo che blocca e completa il regalo soltanto quando `kind === "full_gift"` e `giftId !== null`; il ramo contribution aggiorna solo la richiesta e l'audit.

- [ ] **Step 4: Adeguare inserimento manuale**

Il form rende il regalo obbligatorio per `full_gift` e omissibile per `contribution`; la server action rivalida la combinazione e non crea lock per il fondo comune.

- [ ] **Step 5: Aggiornare documentazione autorevole**

Documentare `gift_id` nullable, migrazione delle contribuzioni storiche, nuovo endpoint e rimozione dell'avanzamento per regalo.

- [ ] **Step 6: Eseguire i test mirati**

Run: `~/Library/pnpm/pnpm test tests/unit/email.test.ts tests/unit/guest-request-page.test.tsx tests/unit/admin-ui.test.tsx tests/unit/admin-server-action-boundaries.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit del task**

```bash
git add src/actions src/app src/lib/email src/lib/admin docs/DATA_MODEL.md PLAN.md tests
git commit -m "feat: support common contributions across admin flows"
```

### Task 5: Adapter pubblico senza avanzamento per regalo

**Files:**
- Modify: `src/data/site-content.ts`
- Modify: `src/lib/public-content/adapter.ts`
- Test: `tests/unit/public-content-adapter.test.ts`

**Interfaces:**
- Produces: `PublicGift` con `priceCents` ancora disponibile al client per il dialog bonifico, ma senza `allowContributions` e `confirmedContributionCents`.
- Stato: `completed` o lock intero; nessuna query o somma di contribution.

- [ ] **Step 1: Scrivere il test fallente dell'adapter**

```ts
expect(mapPublicGifts({ gifts: [databaseGift] })[0]).toEqual(
  expect.objectContaining({ status: "available", allowFullGift: true })
);
expect(result[0]).not.toHaveProperty("confirmedContributionCents");
```

- [ ] **Step 2: Eseguire e osservare il fallimento**

Run: `~/Library/pnpm/pnpm test tests/unit/public-content-adapter.test.ts`
Expected: FAIL perché l'adapter usa ancora contributi verificati.

- [ ] **Step 3: Rimuovere il calcolo delle contribuzioni dal caricamento pubblico**

Caricare soltanto regali e lock. `allowFullGift` è vero per un regalo disponibile; `priceCents` non viene renderizzato nella card ma alimenta il dialog bonifico.

- [ ] **Step 4: Eseguire il test mirato**

Run: `~/Library/pnpm/pnpm test tests/unit/public-content-adapter.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit del task**

```bash
git add src/data/site-content.ts src/lib/public-content/adapter.ts tests/unit/public-content-adapter.test.ts
git commit -m "refactor: detach public gifts from contributions"
```

### Task 6: Nuova esperienza Lista Nozze

**Files:**
- Modify: `src/components/sections/gift-registry.tsx`
- Modify: `src/components/sections/public-home.tsx`
- Modify: `src/styles/registry-dialogs.css`
- Test: `tests/unit/gift-registry.test.tsx`
- Test: `tests/unit/public-home.test.tsx`
- Test: `tests/e2e/registry.spec.ts`

**Interfaces:**
- Consumes: `PublicGift` del Task 5 e `POST /api/registry/contribute` del Task 3.
- Produces: `RegistryContributionCard`, dialog acquisto esterno e dialog bonifico intero.

- [ ] **Step 1: Scrivere test fallenti per card e ordine CTA**

```ts
const card = screen.getByRole("article", { name: "Tavolo" });
expect(within(card).queryByText(/Prezzo di listino/)).toBeNull();
expect(within(card).queryByText("Vedi il prodotto")).toBeNull();
expect(within(card).getAllByRole(/button|link/).map((node) => node.textContent)).toEqual([
  expect.stringContaining("Regala tramite acquisto sul sito"),
  expect.stringContaining("Regala tramite bonifico")
]);
```

- [ ] **Step 2: Scrivere test fallenti per i due dialog**

Il dialog esterno contiene “contatta Giulia o Gabriele tramite WhatsApp”, nessun numero, e un link sicuro al negozio. Il dialog bonifico contiene `Prezzo di listino pieno: 1.000 €`, non mostra radio metodo e invia `method: "bank_transfer"` a `/api/gifts/<id>/reserve`.

- [ ] **Step 3: Scrivere test fallente per il fondo comune**

```ts
await user.click(screen.getByRole("button", { name: "Contribuisci" }));
expect(screen.getByRole("dialog")).toHaveAccessibleName(/mattone/i);
expect(fetch).toHaveBeenCalledWith("/api/registry/contribute", expect.anything());
```

- [ ] **Step 4: Eseguire e osservare i fallimenti**

Run: `~/Library/pnpm/pnpm test tests/unit/gift-registry.test.tsx tests/unit/public-home.test.tsx`
Expected: FAIL sui nuovi testi, layout e endpoint.

- [ ] **Step 5: Implementare componenti e stili minimi**

Rimuovere prezzo/progresso/link/CTA contribution dalle card. Conservare focus restoration Radix; usare un anchor con `target="_blank" rel="noopener noreferrer"` solo dopo il warning. Il fondo comune usa una griglia responsive e la stessa form validation esistente.

- [ ] **Step 6: Eseguire unit test e controlli E2E disponibili**

Run: `~/Library/pnpm/pnpm test tests/unit/gift-registry.test.tsx tests/unit/public-home.test.tsx`
Expected: PASS.

Run: `~/Library/pnpm/pnpm test:e2e tests/e2e/registry.spec.ts`
Expected: PASS se server e browser sono disponibili; altrimenti riportare il vincolo.

- [ ] **Step 7: Commit del task**

```bash
git add src/components/sections src/styles/registry-dialogs.css tests/unit tests/e2e/registry.spec.ts
git commit -m "feat: redesign registry gifting choices"
```

### Task 7: Hero e step tipografici

**Files:**
- Modify: `src/components/sections/public-home.tsx`
- Modify: `src/styles/layout.css`
- Modify: `src/styles/sections.css`
- Test: `tests/unit/public-home.test.tsx`
- Test: `tests/unit/design-tokens.test.ts`
- Test: `tests/e2e/public-home.spec.ts`

**Interfaces:**
- Produces: un solo `h1` con accessible name “Giulia e Gabriele” e span visuali `.hero-name-primary`, `.hero-name-joiner`; `.section-heading > .section-step` limita l'ingrandimento alle tre sezioni principali.

- [ ] **Step 1: Scrivere il test fallente della struttura accessibile**

```ts
const title = screen.getByRole("heading", { level: 1, name: "Giulia e Gabriele" });
expect(within(title).getByText("Giulia")).toHaveClass("hero-name-primary");
expect(within(title).getByText("e")).toHaveClass("hero-name-joiner");
expect(within(title).getByText("Gabriele")).toHaveClass("hero-name-primary");
```

- [ ] **Step 2: Eseguire e osservare il fallimento**

Run: `~/Library/pnpm/pnpm test tests/unit/public-home.test.tsx tests/unit/design-tokens.test.ts`
Expected: FAIL perché il titolo è ancora su una riga e manca lo scope `.section-step`.

- [ ] **Step 3: Implementare markup e CSS responsive**

Usare `aria-label="Giulia e Gabriele"` sull'`h1`, span `aria-hidden="true"` su tre righe, kicker circa doppio e nomi circa un terzo della scala precedente. Applicare la classe `section-step` solo alle tre eyebrow numerate.

- [ ] **Step 4: Eseguire i test mirati**

Run: `~/Library/pnpm/pnpm test tests/unit/public-home.test.tsx tests/unit/design-tokens.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit del task**

```bash
git add src/components/sections/public-home.tsx src/styles/layout.css src/styles/sections.css tests
git commit -m "style: revise hero and section hierarchy"
```

### Task 8: Illustrazione salvadanaio e verifica finale

**Files:**
- Create: `public/graphics/wedding-fund-piggy-bank.png`
- Modify: `src/components/sections/gift-registry.tsx`
- Modify: `tests/e2e/screenshots.spec.ts`

**Interfaces:**
- Produces: PNG trasparente senza testo, marchi o watermark; renderizzato con `next/image`, dimensioni intrinseche e `alt=""`.

- [ ] **Step 1: Generare e ispezionare l'asset**

Prompt: illustrazione editoriale raffinata, maialino salvadanaio in terracotta e avorio con un piccolo mattone che cade nella fessura al posto della moneta, palette bosco/argilla/avorio, sfondo realmente trasparente, nessun testo, logo o watermark.

- [ ] **Step 2: Copiare l'asset nel progetto e renderizzarlo**

```tsx
<Image
  src="/graphics/wedding-fund-piggy-bank.png"
  alt=""
  width={1024}
  height={1024}
/>
```

- [ ] **Step 3: Eseguire la suite completa**

Run: `~/Library/pnpm/pnpm lint && ~/Library/pnpm/pnpm typecheck && ~/Library/pnpm/pnpm test && ~/Library/pnpm/pnpm build`
Expected: tutti i comandi con exit code 0.

- [ ] **Step 4: Eseguire i controlli aggiuntivi**

Run: `~/Library/pnpm/pnpm db:check`
Expected: PASS.

Run: `~/Library/pnpm/pnpm format:check`
Expected: PASS per i file modificati; distinguere eventuali baseline preesistenti.

Run: `~/Library/pnpm/pnpm test:integration`
Expected: PASS soltanto con `TEST_DATABASE_URL` reale, altrimenti skip dichiarato.

Run: `~/Library/pnpm/pnpm test:e2e`
Expected: PASS se browser e server richiesti sono disponibili.

- [ ] **Step 5: Ispezionare diff e stato finale**

Run: `git diff --check && git status --short && git diff --stat`
Expected: nessun whitespace error e soltanto file previsti.

- [ ] **Step 6: Commit finale**

```bash
git add public/graphics/wedding-fund-piggy-bank.png src tests docs PLAN.md
git commit -m "feat: complete common wedding registry flow"
```
