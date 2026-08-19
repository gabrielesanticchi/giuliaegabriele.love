# CODEX TASK — WEDDING WEBSITE “GABRIELE & GIULIA”

Esegui questo task in **Codex usando Sol con livello di ragionamento High**.

Devi progettare e implementare integralmente un wedding website completo, elegante, originale e pronto per la produzione.

Non limitarti a:

- descrivere l’architettura;
- creare wireframe;
- produrre mockup statici;
- generare soltanto la homepage;
- scrivere componenti isolati;
- lasciare TODO essenziali;
- simulare il backend con dati locali come soluzione finale.

Devi creare una vera applicazione full-stack, eseguire i controlli disponibili, correggere gli errori e lasciare una codebase realmente distribuibile su Vercel.

---

# 1. OBIETTIVO GENERALE

Realizza il sito ufficiale del matrimonio di:

> **Gabriele & Giulia**

Il sito deve essere:

- interamente in lingua italiana;
- elegante, moderno ed emozionale;
- mobile-first;
- prevalentemente one-page;
- fortemente visuale;
- accessibile;
- veloce;
- semplice da amministrare;
- pronto per il deploy su Vercel;
- utilizzabile senza registrazione dagli invitati;
- privo di e-commerce;
- privo di pagamenti diretti;
- privo di WordPress;
- privo di CMS esterni.

La funzionalità principale è la **Lista Nozze**, basata sul concetto:

> “Aiutateci a costruire, mattone dopo mattone, la nostra casa insieme.”

Gli invitati devono poter:

- visualizzare i regali;
- vedere quali regali sono disponibili;
- dichiarare di voler regalare interamente un oggetto;
- contribuire economicamente a un regalo, quando previsto;
- acquistare esternamente dal negozio indicato;
- utilizzare il bonifico bancario seguendo le istruzioni ricevute dopo la richiesta.

Gli amministratori devono poter gestire:

- contenuti del sito;
- fotografie e video;
- programma della giornata;
- timeline della relazione;
- dress code;
- regali;
- prenotazioni;
- contributi;
- stati;
- impostazioni;
- dati bancari;
- notifiche.

Tutto deve essere gestito dalla stessa applicazione Next.js attraverso un’area amministrativa protetta.

---

# 2. VINCOLO ARCHITETTURALE FONDAMENTALE

L’intera applicazione deve essere pensata per Vercel.

Deve essere composta da:

```text
Applicazione Next.js full-stack
├── Sito pubblico
├── Area amministrativa protetta
├── API e Server Actions
├── Autenticazione amministratori
├── Accesso al database PostgreSQL
├── Gestione Vercel Blob
├── Gestione Lista Nozze
├── Validazione Turnstile
└── Notifiche email opzionali
```

## 2.1 Hosting e servizi

Usa:

- **Vercel** per il deploy dell’applicazione Next.js;
- **Vercel Functions** per API e logica server-side;
- **PostgreSQL serverless tramite Vercel Marketplace**, preferibilmente Neon;
- **Vercel Blob** per fotografie, poster e video;
- **Vercel Environment Variables** per segreti e configurazioni;
- **Resend collegato al progetto Vercel**, facoltativo, per le email transazionali;
- dominio personalizzato configurabile da Vercel.

## 2.2 Divieti

Non usare:

- WordPress;
- WooCommerce;
- Shopify;
- Strapi;
- Sanity;
- Contentful;
- Supabase Auth;
- Firebase;
- server VPS separati;
- backend Express separato;
- microservizi;
- Docker Compose in produzione;
- CMS esterni;
- file JSON come database production;
- filesystem locale per dati persistenti;
- SQLite in produzione;
- Google Sheets come database;
- Airtable come database;
- API di pagamento.

Il progetto deve essere un’unica applicazione full-stack coerente e facilmente distribuibile.

---

# 3. MODALITÀ OPERATIVA

Lavora come una squadra composta da:

- senior product designer;
- senior visual designer;
- senior brand designer;
- senior frontend engineer;
- senior full-stack engineer;
- database engineer;
- accessibility specialist;
- application security engineer;
- QA engineer.

Segui questo processo:

1. Esamina il repository e tutti i file esistenti.
2. Se il repository è vuoto, inizializza il progetto da zero.
3. Se esiste un’applicazione, conserva ciò che è valido e integra la nuova soluzione senza distruggere configurazioni utili.
4. Crea un breve `PLAN.md` con milestone, architettura e decisioni.
5. Non attendere approvazione dopo il piano: procedi con l’implementazione.
6. Usa versioni stabili e reciprocamente compatibili delle dipendenze.
7. Non inserire segreti o dati reali nel repository.
8. Quando manca un dato reale, usa un valore configurabile o un placeholder chiaramente marcato come demo.
9. Non inventare data, indirizzi, IBAN o informazioni biografiche.
10. Avvia il progetto durante lo sviluppo.
11. Esegui test e build.
12. Genera screenshot responsive.
13. Ispeziona visivamente il risultato.
14. Correggi problemi grafici, tecnici e responsive.
15. Non considerare completo il task finché i criteri di accettazione non sono soddisfatti.

---

# 4. DATI CONFERMATI E DATI MANCANTI

## 4.1 Dati confermati

Usa come dati iniziali:

```text
Primo nome: Gabriele
Secondo nome: Giulia
Nome visualizzato: Gabriele & Giulia
Lingua: Italiano
Fuso orario: Europe/Rome
- data del matrimonio --> 24 Ottobre 2026
- ora del matrimonio --> 11:00
- nome della chiesa o del comune; --> Chiesa San Giovanni Bosco, Caleppio
- indirizzo del ricevimento --> Via Giuseppe Carcassola, 15, 20056 Trezzo sull'Adda MI
- nome della ricevimento --> Villa Cavenago
- orari definitivi --> 11:00 - 23:00
- fotografie;
- video;
- informazioni sul parcheggio --> parcheggio in loco, sulla strada per il parcheggio c'è un cartellone con il nome della location
- URL Maps;
- IBAN + intestatario del conto; --> Beneficiario
Giulia Padovani & Gabriele Santicchi
IT17 W036 6901 6000 8057 8448 583
Revolut Bank UAB 
- email amministrativa --> gabriele@santicchi.it
- dominio definitivo; --> giuliaegabriele.love
- dress code definitivo --> colori autunnali

Predisponi:

- dati demo chiaramente riconoscibili;
- campi modificabili dall’area amministrativa;
- fallback eleganti;
- documentazione per la sostituzione.

Se la data non è configurata, il sito non deve mostrare date false.

---

# 5. STACK TECNOLOGICO

Usa:

- Next.js con App Router;
- React;
- TypeScript in modalità strict;
- Tailwind CSS;
- Server Components dove appropriato;
- Client Components soltanto per interazioni reali;
- Node.js runtime per autenticazione, database, crittografia e upload;
- Drizzle ORM;
- Drizzle Kit per migrazioni;
- PostgreSQL serverless;
- driver PostgreSQL compatibile con Neon e Vercel Functions;
- Vercel Blob;
- Auth.js per l’autenticazione amministrativa;
- Zod;
- React Hook Form;
- Radix UI primitives per dialog, menu e componenti accessibili;
- Lucide React per le icone;
- Motion oppure animazioni CSS leggere;
- Vitest;
- Testing Library;
- Playwright;
- axe-core o integrazione equivalente per test di accessibilità;
- ESLint;
- Prettier;
- pnpm.

Non usare una libreria UI completa che renda il sito simile a un template generico.

Puoi usare primitive accessibili, ma la direzione grafica deve essere completamente personalizzata.

---

# 6. STRUTTURA DEL REPOSITORY

Organizza indicativamente il repository così:

```text
/
├── src/
│   ├── app/
│   │   ├── (public)/
│   │   │   ├── page.tsx
│   │   │   ├── privacy/page.tsx
│   │   │   └── layout.tsx
│   │   ├── admin/
│   │   │   ├── login/page.tsx
│   │   │   ├── page.tsx
│   │   │   ├── contenuti/
│   │   │   ├── matrimonio/
│   │   │   ├── programma/
│   │   │   ├── storia/
│   │   │   ├── dress-code/
│   │   │   ├── lista-nozze/
│   │   │   ├── richieste/
│   │   │   ├── media/
│   │   │   └── impostazioni/
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   ├── gifts/[giftId]/reserve/route.ts
│   │   │   ├── gifts/[giftId]/contribute/route.ts
│   │   │   ├── uploads/route.ts
│   │   │   └── health/route.ts
│   │   ├── error.tsx
│   │   ├── not-found.tsx
│   │   ├── robots.ts
│   │   ├── sitemap.ts
│   │   ├── manifest.ts
│   │   └── opengraph-image.tsx
│   ├── actions/
│   │   ├── admin/
│   │   └── public/
│   ├── components/
│   │   ├── admin/
│   │   ├── forms/
│   │   ├── graphics/
│   │   ├── layout/
│   │   ├── registry/
│   │   ├── sections/
│   │   └── ui/
│   ├── db/
│   │   ├── index.ts
│   │   ├── schema/
│   │   ├── migrations/
│   │   ├── queries/
│   │   └── seed.ts
│   ├── lib/
│   │   ├── auth/
│   │   ├── blob/
│   │   ├── email/
│   │   ├── formatting/
│   │   ├── rate-limit/
│   │   ├── security/
│   │   ├── validation/
│   │   ├── registry/
│   │   └── env.ts
│   ├── data/
│   │   └── demo-content.ts
│   ├── styles/
│   └── types/
├── public/
│   ├── demo/
│   ├── graphics/
│   └── icons/
├── scripts/
│   ├── create-admin.ts
│   ├── reset-admin-password.ts
│   ├── migrate.ts
│   └── seed.ts
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── drizzle.config.ts
├── auth.ts
├── proxy.ts oppure middleware.ts
├── next.config.ts
├── vercel.json
├── .env.example
├── AGENTS.md
├── PLAN.md
├── README.md
├── package.json
└── pnpm-lock.yaml
```

Adatta `proxy.ts` o `middleware.ts` alla convenzione della versione stabile di Next.js effettivamente installata.

---

# 7. DIREZIONE ARTISTICA

## 7.1 Concept

La direzione visuale deve chiamarsi:

> **Bosco Incantato Editoriale**

Deve comunicare:

- eleganza;
- intimità;
- natura;
- calore;
- senso di casa;
- contemporaneità;
- qualità artigianale;
- romanticismo adulto;
- atmosfera cinematografica.

Il risultato non deve sembrare:

- un template matrimoniale economico;
- una landing page SaaS;
- un e-commerce;
- una pagina costruita soltanto con card;
- un catalogo prodotti;
- una composizione rosa e oro stereotipata;
- un tema WordPress;
- un’interfaccia generica creata con componenti standard;
- una pagina con eccessivo glassmorphism;
- un sito infantile o fiabesco in senso letterale.

## 7.2 Palette iniziale

Usa design token simili ai seguenti:

```css
--color-ivory: #f4efe7;
--color-paper: #fbf8f2;
--color-forest: #20342c;
--color-forest-deep: #14231d;
--color-sage: #748476;
--color-moss: #53675b;
--color-clay: #b6754e;
--color-stone: #d8cbb9;
--color-ink: #191d1a;
--color-muted: #686e69;
--color-line: rgba(32, 52, 44, 0.18);
```

Verifica il contrasto reale e modifica i valori quando necessario.

Non usare:

- verde chiaro per testi piccoli;
- grigio a basso contrasto;
- oro brillante;
- gradienti artificiali;
- nero puro su grandi superfici;
- colori neon.

## 7.3 Tipografia

Usa una combinazione editoriale:

- serif elegante per titoli e nomi;
- sans-serif contemporaneo per testi e interfaccia.

Combinazione preferita:

```text
Titoli: Cormorant Garamond
Corpo e UI: Manrope
```

Usa `next/font`.

Prevedi fallback robusti.

Evita:

- font calligrafici per lunghi testi;
- corsivi poco leggibili;
- eccessivo maiuscolo;
- tracking estremo;
- titoli troppo piccoli su mobile.

## 7.4 Monogramma

Crea un monogramma SVG originale per Gabriele e Giulia.

Caratteristiche:

- forma circolare;
- due lettere G chiaramente riconoscibili;
- composizione possibilmente speculare o intrecciata;
- separazione visiva sufficiente per evitare che sembri una singola lettera;
- tratto morbido;
- richiamo astratto a un sentiero, un ramo o una casa;
- niente simbolo generico degli anelli;
- niente cuore banale;
- niente effetto bussola;
- niente corone;
- niente decorazioni eccessive.

Crea:

- versione completa;
- versione monocromatica;
- versione chiara;
- versione scura;
- versione favicon;
- versione watermark.

Il monogramma deve funzionare sia a 32 px sia in grande formato.

## 7.5 Elementi grafici

Integra con moderazione:

- linee botaniche;
- texture carta molto leggera;
- cerchi incompleti;
- segni topografici;
- piccoli dettagli architettonici;
- riferimenti a planimetrie;
- una linea narrativa che richiami un sentiero;
- un motivo “mattone dopo mattone” nella Lista Nozze.

Crea elementi SVG originali.

Non scaricare illustrazioni protette da copyright.

---

# 8. MEDIA E VERCEL BLOB

L’applicazione deve supportare:

- fotografie;
- video hero;
- poster video;
- immagini verticali;
- immagini orizzontali;
- focal point;
- testo alternativo;
- ordinamento;
- sostituzione;
- cancellazione;
- anteprima.

Usa Vercel Blob per i file production.

## 8.1 Upload amministrativo

Gli upload devono:

- essere accessibili soltanto agli amministratori autenticati;
- usare token di upload autorizzati server-side;
- preferire upload diretto client-to-Blob per file grandi;
- limitare MIME type;
- limitare dimensione;
- generare nomi non prevedibili;
- rimuovere caratteri pericolosi;
- registrare i metadati nel database;
- impedire upload HTML, SVG non fidati o file eseguibili;
- consentire JPEG, PNG, WebP, AVIF e video compatibili;
- mostrare stato di avanzamento;
- gestire errori e retry;
- non esporre `BLOB_READ_WRITE_TOKEN`.

Gli SVG grafici originali del progetto possono essere versionati nel repository.

Gli SVG caricati dagli amministratori non devono essere accettati senza sanitizzazione robusta.

## 8.2 Asset demo

Poiché le fotografie reali non sono disponibili:

- crea placeholder locali eleganti;
- usa SVG, gradienti e texture originali;
- evita riquadri grigi anonimi;
- non usare fotografie remote casuali;
- non includere asset senza licenza;
- rendi il sito convincente anche in modalità demo.

---

# 9. NAVIGAZIONE

Realizza una one-page con ancore:

```text
Home
Il matrimonio
Programma
La nostra storia
Dress code
Lista nozze
```

Comportamento header:

- inizialmente trasparente sulla hero;
- cambia aspetto durante lo scroll;
- monogramma sempre riconoscibile;
- menu desktop essenziale;
- menu mobile full-screen o pannello elegante;
- evidenziazione discreta della sezione attiva;
- chiusura del menu dopo la selezione;
- corretta gestione del focus;
- supporto tastiera;
- nessuno scroll orizzontale.

Aggiungi una CTA discreta:

```text
Lista nozze
```

Non renderla aggressiva.

Implementa smooth scrolling rispettando `prefers-reduced-motion`.

---

# 10. HOME E HERO

## 10.1 Hero

La hero deve occupare almeno l’intero viewport iniziale.

Deve supportare:

- fotografia full-screen;
- video full-screen;
- poster;
- overlay;
- focal point;
- posizione contenuto;
- monogramma;
- nomi;
- data;
- luogo sintetico;
- frase introduttiva;
- countdown;
- indicatore di scroll.

Testo principale:

```text
Gabriele & Giulia
```

Il video, quando presente, deve essere:

- muto;
- in loop;
- `playsInline`;
- dotato di poster;
- dotato di controllo pausa/ripresa;
- disabilitato in caso di `prefers-reduced-motion`;
- sostituito dal poster quando necessario;
- ottimizzato per mobile.

## 10.2 Data non configurata

Se la data non è configurata:

- non usare una data inventata;
- mostra “La data sarà annunciata presto”;
- non avviare il countdown;
- non generare `NaN`;
- non produrre hydration mismatch;
- non mostrare zeri fittizi.

## 10.3 Countdown

Quando la data è disponibile, mostra:

- giorni;
- ore;
- minuti;
- secondi.

Usa:

```text
Europe/Rome
```

Gestisci:

- rendering server/client;
- data futura;
- giorno del matrimonio;
- data trascorsa;
- assenza JavaScript;
- cleanup del timer;
- cambio di minuto;
- cambio dell’ora legale.

Testi:

```text
Prima della data: Manca sempre meno
Durante il giorno: Oggi ci sposiamo
Dopo la data: Il nostro viaggio è iniziato
```

---

# 11. SEZIONE “IL MATRIMONIO”

Crea due composizioni editoriali distinte.

Non usare due card SaaS identiche.

## 11.1 Cerimonia

Mostra:

- nome della chiesa, comune o location;
- indirizzo;
- data e orario;
- informazioni sul parcheggio;
- fotografia;
- pulsante “Apri Maps”.

## 11.2 Ricevimento

Mostra:

- nome della location;
- indirizzo;
- orario indicativo;
- informazioni sul parcheggio;
- fotografia;
- pulsante “Apri Maps”.

## 11.3 Maps

I link Maps devono:

- essere configurabili;
- aprirsi in nuova scheda;
- avere `rel="noopener noreferrer"`;
- avere un nome accessibile;
- accettare soltanto protocolli sicuri;
- non apparire se non configurati.

Non incorporare mappe di terze parti per impostazione predefinita.

Non caricare cookie Google automaticamente.

---

# 12. PROGRAMMA DELLA GIORNATA

Crea una timeline verticale molto leggibile da smartphone.

Dati demo iniziali:

```text
15:30 — Arrivo invitati
16:00 — Cerimonia
17:30 — Ricevimento
19:30 — Cena
22:30 — Torta
23:00 — Party
```

Questi dati devono essere modificabili dall’area amministrativa.

Ogni elemento deve supportare:

- orario;
- titolo;
- descrizione opzionale;
- icona opzionale;
- ordine;
- pubblicato/non pubblicato.

Design:

- linea verticale;
- indicatori morbidi;
- animazione progressiva;
- ottima leggibilità;
- ordine semantico naturale;
- nessuna alternanza problematica su mobile;
- layout editoriale più ampio su desktop.

---

# 13. LA NOSTRA STORIA

Crea una timeline fotografica con 4–6 momenti.

Ogni momento deve supportare:

- anno o data testuale;
- fotografia;
- titolo;
- testo breve;
- alt text;
- ordine;
- pubblicato/non pubblicato.

La sezione deve essere:

- visuale;
- narrativa;
- intima;
- sintetica;
- priva di lunghi muri di testo.

Dati demo:

```text
Il primo incontro
Il primo viaggio
La nostra prima casa
La proposta
Verso il grande giorno
```

Non inventare dettagli biografici specifici.

Indica chiaramente nel pannello e nel seed che si tratta di contenuti demo.

Non usare un carosello obbligatorio che nasconda i contenuti.

---

# 14. DRESS CODE

La sezione deve supportare:

- nome dello stile;
- descrizione;
- palette colori;
- immagini di riferimento;
- indicazioni particolari;
- colori sconsigliati opzionali;
- indicazioni su comfort, terreno o temperatura;
- ordinamento delle immagini.

La palette deve:

- mostrare il nome testuale del colore;
- supportare da 3 a 8 colori;
- avere swatch eleganti;
- non comunicare informazioni soltanto tramite colore;
- avere bordi visibili;
- mantenere contrasto sufficiente.

Il tono non deve risultare rigido o sgradevole.

---

# 15. LISTA NOZZE — “COSTRUIAMO CASA INSIEME”

Questa è la funzionalità principale.

## 15.1 Introduzione

Titolo:

```text
Costruiamo casa insieme
```

Testo demo:

> Abbiamo immaginato questa lista come la nostra futura casa: una stanza, un oggetto e un piccolo progetto alla volta. Se desiderate farci un regalo, potete aiutarci a costruirla insieme, mattone dopo mattone.

Spiegazione:

> Nessun pagamento avviene su questo sito. Potrete acquistare il regalo dal negozio indicato oppure scegliere il bonifico. Saremo noi a verificare manualmente ogni acquisto o contributo.

Aggiungi:

> La vostra presenza sarà già il regalo più bello. Questa lista è soltanto per chi desidera aiutarci a costruire qualcosa che resterà con noi.

## 15.2 Categorie

Supporta categorie opzionali:

```text
Cucina
Soggiorno
Camera
Bagno
Esterni
Tecnologia
Progetti speciali
```

Aggiungi filtri:

```text
Tutti
Disponibili
In attesa
Regalati
```

I filtri devono:

- essere accessibili;
- aggiornare il conteggio;
- funzionare con tastiera;
- non essere l’unico modo per riconoscere lo stato;
- mantenere un URL o stato coerente quando utile.

## 15.3 Card regalo

Ogni regalo deve contenere:

- immagine;
- alt text;
- categoria;
- stanza;
- nome;
- descrizione breve;
- prezzo indicativo;
- link esterno;
- nome negozio;
- regalo completo consentito;
- contributi consentiti;
- contributo minimo;
- importo confermato;
- importo rimanente;
- importo temporaneamente impegnato;
- stato;
- ordine;
- evidenza opzionale;
- etichetta opzionale “Un mattone importante”.

Gli importi devono essere memorizzati in centesimi interi.

Non usare floating point per il denaro.

Formattazione:

```ts
new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
});
```

## 15.4 Design delle card

Le card devono sembrare parte di un progetto editoriale per la casa.

Usa:

- fotografia ampia;
- rapporto immagine coerente;
- bordo sottile;
- numerazione discreta;
- etichetta ambiente;
- dettagli da planimetria;
- CTA chiare;
- transizioni leggere;
- una colonna su mobile;
- griglia editoriale su desktop.

Evita:

- “Compra ora”;
- badge promozionali;
- rating;
- recensioni;
- quantità;
- carrello;
- checkout;
- diciture da marketplace;
- prezzo eccessivamente dominante.

---

# 16. STATI PUBBLICI DEI REGALI

Gli unici stati pubblici devono essere esattamente tre.

## 16.1 Disponibile

Etichetta:

```text
DISPONIBILE
```

Significato:

- può essere regalato interamente;
- può ricevere contributi quando abilitati;
- mostra le CTA disponibili.

## 16.2 Qualcuno ci sta pensando

Etichetta esatta:

```text
QUALCUNO STA GIÀ PENSANDO A QUESTO REGALO
```

Significato:

- qualcuno ha dichiarato di voler regalare l’intero oggetto;
- il regalo è temporaneamente bloccato;
- il periodo predefinito è di 48 ore;
- nessun altro può selezionare “Regala”;
- per impostazione predefinita non riceve nuovi contributi;
- la verifica è manuale;
- nessun dato dell’invitato è pubblico.

L’etichetta deve andare a capo correttamente su mobile.

## 16.3 Regalato

Etichetta esatta:

```text
REGALATO ❤️
```

Significato:

- l’amministratore ha verificato l’acquisto;
- oppure i contributi confermati hanno raggiunto il target;
- tutte le CTA sono disabilitate;
- il regalo rimane visibile.

## 16.4 Stati interni

Usa stati interni più granulari:

```text
pending
verified
cancelled
expired
rejected
```

Questi stati non devono comparire direttamente sul sito pubblico.

Mappa sempre lo stato interno su uno dei tre stati pubblici.

---

# 17. FLUSSO “REGALA”

Sulla card disponibile mostra:

```text
Regala
```

## 17.1 Modal

Il modal deve:

- avere focus iniziale controllato;
- intrappolare il focus;
- chiudersi con Escape;
- avere pulsante di chiusura;
- ripristinare il focus;
- bloccare lo scroll;
- avere titolo e descrizione ARIA;
- funzionare da tastiera;
- funzionare con screen reader;
- diventare un bottom sheet accessibile su mobile, se opportuno.

## 17.2 Copy

Usa:

> Vuoi regalarci questo pezzo della nostra casa?

> Per evitare doppioni, terremo il regalo riservato a tuo nome per 48 ore. Il pagamento non avviene su questo sito: potrai acquistarlo dal negozio indicato oppure procedere con bonifico. Quando avremo verificato l’acquisto o il bonifico, lo segneremo come “Regalato ❤️”.

Aggiungi:

> La prenotazione non costituisce un pagamento né un ordine commerciale.

## 17.3 Metodo

Permetti di scegliere:

### Acquisto dal negozio

Mostra:

- nome negozio;
- prezzo indicativo;
- link esterno;
- nota sulla possibile variazione del prezzo;
- invito a completare entro 48 ore.

Dopo la prenotazione mostra:

```text
Vai al negozio
```

### Bonifico bancario

Mostra le coordinate soltanto dopo che il backend ha accettato la richiesta.

Non includere IBAN:

- nel bundle client;
- nelle pagine pubbliche;
- nei dati demo;
- nelle variabili `NEXT_PUBLIC_*`;
- nelle API GET;
- nei log;
- nell’HTML iniziale.

## 17.4 Campi

Obbligatori:

- nome;
- cognome;
- email;
- conferma email;
- metodo;
- consenso privacy.

Opzionali:

- telefono;
- messaggio.

Aggiungi:

- honeypot;
- Turnstile;
- idempotency key;
- limite caratteri;
- errori inline;
- error summary;
- stato di caricamento;
- protezione da doppio click.

Non chiedere:

- indirizzo postale;
- codice fiscale;
- documento;
- password;
- dati bancari dell’invitato.

## 17.5 Risposta positiva

Mostra:

- riferimento univoco;
- regalo;
- scadenza indicativa;
- metodo;
- istruzioni;
- pulsanti copia;
- link negozio o coordinate bancarie.

Copy:

> Perfetto, questo regalo è stato riservato per te.

> Per evitare doppioni lo terremo in attesa per 48 ore. Appena avremo verificato l’acquisto o il bonifico, lo contrassegneremo come “Regalato ❤️”.

## 17.6 Concorrenza

La prenotazione deve essere atomica.

Se due persone tentano di prenotare contemporaneamente lo stesso regalo:

- soltanto una richiesta deve riuscire;
- la seconda deve ricevere HTTP `409`;
- aggiorna immediatamente la card;
- non affidarti allo stato del browser.

Messaggio:

> Qualcuno ha appena scelto questo regalo. La lista è stata aggiornata: puoi dare un’occhiata agli altri pezzi della nostra casa.

---

# 18. FLUSSO “CONTRIBUISCI”

Mostra:

```text
Contribuisci
```

soltanto quando:

- il regalo è disponibile;
- i contributi sono abilitati;
- rimane un importo finanziabile.

## 18.1 Copy

> Anche un piccolo contributo può diventare un mattone della nostra casa.

> Scegli l’importo che desideri. Il pagamento avverrà tramite bonifico e verrà conteggiato nella lista soltanto dopo la nostra verifica.

## 18.2 Importo

Supporta:

- importi suggeriti;
- importo personalizzato;
- minimo configurabile;
- massimo pari all’importo ancora impegnabile;
- euro e centesimi;
- validazione client;
- validazione server;
- concorrenza.

Importi suggeriti demo:

```text
25 €
50 €
100 €
```

Non conteggiare un contributo finché l’amministratore non lo verifica.

## 18.3 Contributi in attesa

Per evitare che più intenzioni superino il valore del regalo:

- considera internamente gli importi pending;
- calcola l’importo ancora impegnabile come:

```text
prezzo - contributi confermati - contributi pending attivi
```

- non mostrare i contributi pending nella progress bar;
- non rivelare nomi o importi individuali;
- impedisci atomicamente contributi superiori al residuo;
- se il residuo impegnabile è zero, disabilita temporaneamente la CTA;
- mostra eventualmente:

```text
Alcuni contributi sono in attesa di verifica.
```

Questo testo non deve diventare un quarto stato pubblico.

## 18.4 Conferma

Dopo l’accettazione mostra:

- riferimento;
- importo;
- intestatario;
- IBAN;
- banca opzionale;
- causale;
- pulsanti copia;
- nota sulla verifica manuale.

Formato causale:

```text
CASA-{GIFT_ID}-{REFERENCE}
```

La causale deve essere generata server-side.

---

# 19. PROGRESSO DEI CONTRIBUTI

Supporta due modalità configurabili.

## 19.1 Esplicita

```text
350 € raccolti su 900 €
```

## 19.2 Discreta

```text
La nostra casa sta prendendo forma
```

Requisiti:

- usa soltanto contributi verificati;
- non mostrare nomi;
- non mostrare donatori;
- progress bar accessibile;
- valore testuale;
- non comunicare soltanto tramite colore;
- nessun importo negativo;
- completamento automatico al raggiungimento del target;
- calcoli in centesimi.

---

# 20. AREA AMMINISTRATIVA

Crea un’area protetta:

```text
/admin
```

Interfaccia interamente in italiano.

## 20.1 Navigazione admin

Sezioni:

```text
Panoramica
Sito e Hero
Il matrimonio
Programma
La nostra storia
Dress code
Lista nozze
Richieste
Media
Impostazioni
Audit log
```

## 20.2 Dashboard

Mostra:

- regali disponibili;
- regali prenotati;
- regali completati;
- contributi in attesa;
- contributi verificati;
- prenotazioni scadute;
- richieste recenti;
- valore totale della lista;
- valore confermato;
- azioni rapide.

Non trasformare il pannello in un prodotto SaaS eccessivamente complesso.

Deve essere pulito, professionale e semplice.

## 20.3 Modifica contenuti

Permetti di modificare:

- nomi;
- data;
- luogo sintetico;
- frase hero;
- media hero;
- cerimonia;
- ricevimento;
- programma;
- storia;
- dress code;
- introduzione lista;
- testi dei modali;
- impostazioni contributi;
- SEO;
- privacy;
- noindex.

Usa campi strutturati.

Evita un editor HTML libero quando non necessario.

## 20.4 Stato bozza

Supporta:

- bozza;
- pubblicato;
- ordinamento;
- anteprima privata.

Il sito pubblico deve mostrare soltanto contenuti pubblicati.

La preview deve richiedere autenticazione e avere `noindex`.

---

# 21. AUTENTICAZIONE AMMINISTRATIVA

Usa Auth.js con provider Credentials.

Requisiti:

- nessuna registrazione pubblica;
- amministratori creati via CLI;
- password hashata;
- sessione sicura;
- cookie `HttpOnly`;
- cookie `Secure` in produzione;
- `SameSite=Lax` o più restrittivo dove compatibile;
- session expiration;
- logout;
- protezione di tutte le pagine admin;
- protezione di Server Actions e Route Handler;
- rate limit sul login;
- messaggi generici in caso di credenziali errate;
- nessuna distinzione pubblica tra email esistente e inesistente.

Crea comandi:

```text
pnpm admin:create
pnpm admin:reset-password
pnpm admin:list
```

`admin:create` deve:

- chiedere email;
- chiedere password in modo non visibile;
- validare robustezza;
- generare hash;
- creare l’utente nel database;
- non salvare la password in file o log.

Non inserire una password amministrativa predefinita.

Non creare un endpoint pubblico di bootstrap.

---

# 22. MODELLO DATABASE

Usa Drizzle ORM e migrazioni versionate.

## 22.1 Tabelle minime

Crea almeno:

```text
admin_users
site_settings
media_assets
schedule_items
story_moments
dress_code_colors
gift_categories
gifts
gift_intents
gift_locks
audit_logs
rate_limit_buckets
email_deliveries
```

## 22.2 Admin users

Campi indicativi:

```text
id
email
password_hash
display_name
role
session_version
is_active
last_login_at
created_at
updated_at
```

## 22.3 Site settings

Singleton con:

- nomi;
- data ISO;
- timezone;
- luogo;
- frase hero;
- configurazione hero;
- cerimonia;
- ricevimento;
- dress code;
- testi Lista Nozze;
- ore prenotazione;
- impostazioni contributi;
- SEO;
- privacy version;
- email amministrativa;
- impostazioni notifiche.

Puoi usare colonne JSONB strutturate e validate con Zod.

Non inserire tutto in una singola stringa HTML.

## 22.4 Media assets

Campi:

```text
id
blob_url
pathname
content_type
size_bytes
width
height
duration_seconds
alt_text
focal_x
focal_y
created_by
created_at
deleted_at
```

## 22.5 Gifts

Campi:

```text
id
slug
title
short_description
long_description
image_id
category_id
room
price_cents
external_purchase_url
external_store_name
allow_full_gift
allow_contributions
minimum_contribution_cents
is_featured
sort_order
publication_status
completed_at
created_at
updated_at
```

## 22.6 Gift intents

Campi:

```text
id
reference
idempotency_key
gift_id
kind
method
status
amount_cents
first_name
last_name
email
phone
message
privacy_version
request_fingerprint_hash
created_at
expires_at
verified_at
cancelled_at
verified_by
admin_notes
metadata_json
```

Valori `kind`:

```text
full_gift
contribution
```

Valori `method`:

```text
external_purchase
bank_transfer
```

Valori `status`:

```text
pending
verified
cancelled
expired
rejected
```

Requisiti:

- UUID o ULID non prevedibile;
- reference pubblica distinta dall’ID;
- idempotency key univoca;
- indici su gift, stato, email hash e scadenza;
- timestamp UTC;
- nessun IP grezzo persistito;
- messaggi con limite;
- email normalizzata;
- query parametrizzate.

## 22.7 Gift locks

Campi:

```text
gift_id
intent_id
created_at
expires_at
```

Usa `gift_id` come chiave univoca o primaria.

Un regalo può avere un solo lock attivo.

## 22.8 Audit log

Campi:

```text
id
admin_user_id
action
entity_type
entity_id
metadata_json
created_at
```

Non salvare nell’audit log:

- password;
- IBAN;
- email completa;
- telefono;
- messaggio completo;
- token;
- cookie.

## 22.9 Vincoli database

Implementa:

- foreign key;
- indici;
- unique constraint;
- check constraint sugli importi;
- check constraint sugli stati;
- cancellazioni controllate;
- transazioni;
- migrazioni reversibili dove ragionevole.

---

# 23. PRENOTAZIONE ATOMICA

Il flusso “Regala” deve usare una transazione database.

Procedura concettuale:

1. valida la richiesta;
2. verifica idempotency key;
3. apre transazione;
4. legge e blocca il regalo oppure applica un vincolo equivalente;
5. verifica che non sia completato;
6. verifica che non esista un lock;
7. crea la richiesta;
8. inserisce il lock con `gift_id` univoco;
9. commit;
10. invalida la cache;
11. invia eventuali notifiche.

Non implementare:

```text
SELECT stato
→ attesa
→ UPDATE
```

senza vincolo univoco o transazione.

Una violazione del vincolo del lock deve produrre HTTP `409`, non HTTP `500`.

---

# 24. CONTRIBUTI ATOMICI

Il flusso “Contribuisci” deve:

1. validare importo;
2. aprire una transazione;
3. leggere il regalo in modo coerente;
4. calcolare contributi verificati;
5. calcolare contributi pending;
6. calcolare il residuo impegnabile;
7. rifiutare importi superiori;
8. creare l’intenzione;
9. commit;
10. invalidare la cache.

Quando un contributo viene verificato:

- impedisci doppie verifiche;
- aggiorna il totale in modo atomico;
- imposta il regalo completato al raggiungimento del target;
- cancella o segnala eventuali richieste incompatibili;
- registra l’azione nell’audit log.

---

# 25. DATI BANCARI

I dati bancari devono essere modificabili dall’area amministrativa.

Campi:

- intestatario;
- IBAN;
- banca opzionale;
- istruzioni;
- formato causale.

## 25.1 Protezione

Non esporre questi valori:

- nel client bundle;
- nelle API GET;
- nei Server Component pubblici;
- nei log;
- nelle metriche;
- nei dati demo;
- nei file versionati.

Memorizzali cifrati nel database usando:

- AES-256-GCM;
- chiave server-side;
- IV casuale;
- authentication tag;
- versione del formato cifrato.

Variabile:

```text
DATA_ENCRYPTION_KEY
```

La chiave non deve essere derivata da `AUTH_SECRET`.

Non includere fallback insicuri in produzione.

Le coordinate vengono decifrate soltanto server-side quando:

- un amministratore autenticato le modifica o visualizza;
- una richiesta pubblica valida viene accettata;
- viene generata un’email autorizzata.

Le risposte che contengono dati bancari devono avere:

```text
Cache-Control: no-store
```

---

# 26. API PUBBLICHE

Crea almeno:

```text
POST /api/gifts/{giftId}/reserve
POST /api/gifts/{giftId}/contribute
GET  /api/health
```

I contenuti pubblici possono essere caricati direttamente dai Server Component attraverso query server-side.

Non creare API pubbliche superflue.

## 26.1 Prenotazione

Payload indicativo:

```ts
interface ReserveGiftRequest {
  method: "external_purchase" | "bank_transfer";
  guest: {
    firstName: string;
    lastName: string;
    email: string;
    emailConfirmation: string;
    phone?: string;
    message?: string;
  };
  privacyAccepted: true;
  privacyVersion: string;
  turnstileToken: string;
  honeypot: string;
  idempotencyKey: string;
}
```

## 26.2 Contributo

```ts
interface ContributionRequest {
  amountCents: number;
  guest: {
    firstName: string;
    lastName: string;
    email: string;
    emailConfirmation: string;
    phone?: string;
    message?: string;
  };
  privacyAccepted: true;
  privacyVersion: string;
  turnstileToken: string;
  honeypot: string;
  idempotencyKey: string;
}
```

## 26.3 Risposta positiva

```ts
interface GiftIntentSuccess {
  ok: true;
  reference: string;
  giftStatus: "available" | "reserved";
  expiresAt: string | null;
  instructions: {
    type: "external_purchase" | "bank_transfer";
    storeUrl?: string;
    storeName?: string;
    accountHolder?: string;
    iban?: string;
    bankName?: string;
    transferReason?: string;
  };
}
```

## 26.4 Errori

Usa:

```text
400 invalid_request
403 forbidden
409 gift_unavailable
409 amount_unavailable
409 duplicate_request
422 validation_failed
429 rate_limited
500 internal_error
503 service_unavailable
```

Non restituire:

- stack trace;
- query SQL;
- dettagli interni;
- nomi di tabelle;
- segreti;
- dati di altri invitati.

---

# 27. VALIDAZIONE E ANTI-SPAM

Integra Cloudflare Turnstile.

Variabili:

```text
NEXT_PUBLIC_TURNSTILE_SITE_KEY
TURNSTILE_SECRET_KEY
```

Il token deve essere verificato server-side.

Gestisci:

- token assente;
- token non valido;
- token scaduto;
- token già usato;
- errore di rete;
- timeout;
- reset del widget;
- hostname production;
- chiavi di test per Playwright.

Aggiungi:

- honeypot;
- idempotency key;
- controllo Origin;
- controllo `Content-Type`;
- dimensione massima del body;
- rate limiting;
- limite caratteri;
- timeout;
- protezione da doppio click;
- backoff dopo errori ripetuti.

Non usare un `Map` in memoria come unico rate limiter in ambiente serverless.

Implementa rate limiting database-backed con operazioni atomiche oppure usa un servizio Redis collegato tramite Vercel Marketplace soltanto se realmente necessario.

Per il volume previsto, preferisci una soluzione PostgreSQL semplice e robusta.

Il fingerprint può essere un HMAC dell’IP lato server.

Non persistere l’IP grezzo.

---

# 28. SCADENZA DELLE 48 ORE

Salva:

```text
expires_at
```

con valore predefinito:

```text
created_at + 48 ore
```

Le ore devono essere configurabili.

Non automatizzare inizialmente lo sblocco.

Quindi:

- nessun Cron Job che cancella automaticamente;
- nessuna cancellazione automatica;
- il lock rimane finché un amministratore interviene;
- le richieste oltre la scadenza vengono evidenziate come scadute nel pannello;
- l’amministratore può sbloccare;
- l’amministratore può prolungare;
- l’amministratore può cancellare;
- l’amministratore può confermare comunque.

Lo stato interno `expired` non deve apparire sul sito pubblico.

Pubblicamente il regalo rimane:

```text
QUALCUNO STA GIÀ PENSANDO A QUESTO REGALO
```

finché il lock non viene rimosso.

---

# 29. GESTIONE RICHIESTE NELL’ADMIN

Crea:

```text
/admin/richieste
```

Mostra una tabella responsive con:

- riferimento;
- regalo;
- tipo;
- metodo;
- importo;
- invitato;
- email;
- data;
- scadenza;
- stato;
- azioni.

Filtri:

```text
Tutte
Prenotazioni
Contributi
In attesa
Confermate
Scadute
Cancellate
```

Azioni:

- conferma acquisto;
- conferma bonifico;
- registra importo effettivo;
- completa regalo;
- cancella richiesta;
- rifiuta richiesta;
- sblocca regalo;
- prolunga prenotazione;
- aggiungi nota;
- reinvia email;
- esporta CSV.

Ogni azione deve:

- verificare la sessione;
- verificare l’autorizzazione;
- usare POST o Server Action;
- essere idempotente;
- mostrare conferma per azioni distruttive;
- registrare audit log;
- invalidare cache;
- gestire errori.

## 29.1 Conferma regalo completo

Quando confermato:

- richiesta → `verified`;
- regalo → completato;
- lock → rimosso;
- `completed_at` valorizzato;
- audit log;
- eventuale email.

## 29.2 Conferma contributo

Quando confermato:

- richiesta → `verified`;
- usa importo effettivamente ricevuto;
- aggiorna il totale;
- impedisce doppia conferma;
- completa il regalo quando necessario;
- audit log;
- eventuale email.

## 29.3 Esportazione CSV

Proteggi da CSV formula injection.

Valori che iniziano con:

```text
=
+
-
@
```

devono essere neutralizzati.

Non includere dati bancari nel CSV.

---

# 30. GESTIONE REGALI NELL’ADMIN

Crea CRUD completo.

Campi:

- titolo;
- slug;
- descrizione breve;
- descrizione estesa;
- immagine;
- alt text;
- categoria;
- stanza;
- prezzo;
- nome negozio;
- URL negozio;
- regalo intero consentito;
- contributi consentiti;
- contributo minimo;
- importi suggeriti;
- evidenza;
- ordinamento;
- stato pubblicazione.

Funzioni:

- crea;
- modifica;
- duplica;
- archivia;
- riordina;
- anteprima;
- pubblica;
- nascondi.

Impedisci la cancellazione accidentale di un regalo con richieste collegate.

Preferisci archiviazione o soft delete.

---

# 31. CACHE E AGGIORNAMENTO DATI

Usa cache e revalidation senza compromettere gli stati.

Strategia suggerita:

- contenuti editoriali con cache tag;
- lista regali con cache breve;
- mutation con `no-store`;
- `revalidateTag` dopo modifiche admin;
- `revalidateTag` dopo prenotazione;
- `revalidateTag` dopo contributo;
- aggiornamento client immediato dopo successo;
- `router.refresh()` quando appropriato.

Tag:

```text
wedding-content
wedding-schedule
wedding-story
wedding-dress-code
wedding-gifts
wedding-admin-dashboard
```

Dopo una risposta `409`:

- aggiorna i dati;
- chiudi o aggiorna il modal;
- mostra messaggio;
- non lasciare CTA attiva.

---

# 32. MODALITÀ DEMO

Il progetto deve funzionare anche senza database durante la prima anteprima locale.

Crea:

```text
src/data/demo-content.ts
```

Variabile:

```text
WEDDING_DEMO_MODE=true
```

In modalità demo:

- usa Gabriele e Giulia;
- usa data `null`;
- mostra contenuti demo;
- usa asset locali;
- mostra programma demo;
- mostra momenti demo;
- mostra almeno otto regali;
- i form possono simulare il successo soltanto in development;
- mostra un piccolo indicatore “Modalità demo” soltanto in development.

In production:

- non simulare prenotazioni persistenti;
- se il database non è configurato, restituisci errore controllato;
- non fingere di aver salvato dati;
- non mostrare il badge demo.

---

# 33. REGALI DEMO

Crea almeno otto regali:

```text
Tavolo per la nostra cucina
Servizio di piatti
Libreria del soggiorno
Lampada per l’angolo lettura
Materasso
Robot aspirapolvere
Set per il terrazzo
Progetto guardaroba
```

Distribuiscili tra:

- Cucina;
- Soggiorno;
- Camera;
- Tecnologia;
- Esterni.

Includi:

- almeno tre disponibili;
- almeno uno prenotato;
- almeno uno regalato;
- almeno due con contributi;
- almeno uno con progresso parziale;
- almeno uno in evidenza.

Usa marchi generici.

Non fingere partnership commerciali.

I prezzi devono essere indicativi.

---

# 34. EMAIL TRANSAZIONALI

Integra Resend in modo opzionale.

L’applicazione deve funzionare anche senza email provider.

Se Resend non è configurato:

- la richiesta deve essere comunque salvata;
- l’amministratore deve vedere la richiesta;
- il fallimento deve essere registrato senza dati sensibili;
- l’utente deve ricevere una conferma sul sito;
- non annullare la transazione.

## 34.1 Email amministratore

Oggetto:

```text
Nuova richiesta Lista Nozze — {giftName}
```

Contenuto:

- riferimento;
- regalo;
- tipo;
- metodo;
- invitato;
- importo;
- data;
- link admin.

## 34.2 Email prenotazione

Oggetto:

```text
Abbiamo riservato il tuo regalo
```

Contenuto:

- ringraziamento;
- regalo;
- riferimento;
- scadenza;
- istruzioni;
- link negozio o coordinate;
- nota sulla verifica manuale.

## 34.3 Email contributo

Oggetto:

```text
Grazie per il tuo mattone della nostra casa
```

Contenuto:

- importo;
- regalo;
- riferimento;
- coordinate;
- causale;
- nota sulla verifica.

## 34.4 Email conferma

Invia una conferma quando l’amministratore verifica la richiesta.

Le email devono:

- essere in italiano;
- avere HTML e testo;
- essere semplici;
- avere escaping;
- non includere dati di altri invitati;
- non includere segreti;
- non causare rollback in caso di errore.

---

# 35. ANIMAZIONI

Usa animazioni sobrie:

- fade;
- slide brevi;
- reveal fotografici;
- disegno progressivo timeline;
- parallasse minima;
- transizioni di stato;
- microinterazione sul monogramma;
- progress bar;
- hover delicati.

Non usare:

- scroll hijacking;
- cursor personalizzato;
- animazioni continue;
- testo rimbalzante;
- rotazioni decorative;
- effetti pesanti;
- animazioni che causano layout shift.

Supporta completamente:

```text
prefers-reduced-motion
```

---

# 36. ACCESSIBILITÀ

Raggiungi almeno un livello sostanziale WCAG 2.2 AA.

Verifica:

- HTML semantico;
- un solo `h1`;
- gerarchia titoli;
- skip link;
- menu da tastiera;
- focus visibile;
- dialog accessibili;
- etichette form;
- error summary;
- errori associati ai campi;
- live region;
- contrasto;
- alt text;
- stati non comunicati soltanto dal colore;
- target touch almeno 44×44 px;
- zoom 200%;
- font scaling;
- reduced motion;
- focus restore;
- nessun contenuto essenziale soltanto hover;
- tastiera mobile;
- autocomplete corretto;
- annunci screen reader dopo invio form.

Il cuore in `REGALATO ❤️` non deve essere l’unico indicatore.

---

# 37. PRIVACY E GDPR

Crea:

```text
/privacy
```

Il contenuto iniziale deve essere marcato come modello da verificare.

Il form deve:

- collegare l’informativa;
- richiedere consenso esplicito;
- registrare versione privacy;
- raccogliere soltanto dati necessari;
- non preselezionare il consenso.

Prevedi:

- cancellazione manuale;
- esportazione amministrativa;
- retention configurabile;
- anonimizzazione;
- nessun dato personale nei log;
- nessun nome donatore pubblico;
- nessuna email in query string;
- nessun dato personale in analytics;
- nessun dato personale nei metadata.

Non mostrare cookie banner se non vengono utilizzati cookie non essenziali.

Analytics e Speed Insights devono essere opzionali e disabilitati per default.

---

# 38. SICUREZZA

Implementa:

- validazione client e server;
- Zod;
- escaping;
- query parametrizzate;
- session check;
- role check;
- CSRF protection adeguata;
- Origin check;
- Turnstile;
- honeypot;
- rate limiting;
- idempotenza;
- transazioni;
- unique constraint;
- protezione race condition;
- limiti di lunghezza;
- allowlist protocolli URL;
- protezione CSV;
- nessun open redirect;
- nessun HTML arbitrario;
- nessun secret client-side;
- nessuna password nei log;
- nessun dato bancario in cache;
- timeout;
- errori controllati.

Aggiungi security header:

```text
Content-Security-Policy
X-Content-Type-Options: nosniff
Referrer-Policy
Permissions-Policy
Strict-Transport-Security in production HTTPS
protezione da framing
```

La CSP deve supportare:

- asset locali;
- Vercel Blob;
- font;
- immagini;
- video;
- Turnstile;
- eventuale Resend soltanto server-side.

Non usare `unsafe-eval` in produzione.

Riduci `unsafe-inline` quando tecnicamente possibile.

---

# 39. SEO E CONDIVISIONE

Implementa:

- Metadata API;
- titolo;
- descrizione;
- canonical;
- favicon;
- Apple touch icon;
- Open Graph image;
- manifest;
- `robots.ts`;
- `sitemap.ts`;
- metadata italiani.

Open Graph iniziale:

```text
Gabriele & Giulia
```

L’immagine Open Graph deve includere:

- monogramma;
- nomi;
- data, solo se configurata;
- palette del sito.

Imposta inizialmente:

```text
noindex, nofollow
```

Consenti di abilitarne l’indicizzazione dall’admin o tramite configurazione.

Tutte le pagine `/admin` devono sempre essere `noindex`.

---

# 40. PERFORMANCE

Obiettivi indicativi:

```text
Lighthouse Performance ≥ 90
Accessibility ≥ 95
Best Practices ≥ 95
SEO ≥ 90 quando indicizzabile
```

Implementa:

- immagini responsive;
- `next/image`;
- dimensioni note;
- lazy loading;
- priorità soltanto alla hero;
- poster video;
- video ottimizzato;
- componenti client ridotti;
- font ottimizzati;
- bundle contenuto;
- skeleton discreti;
- error boundary;
- timeout;
- retry limitato;
- nessun layout shift evidente;
- nessun errore console;
- nessuno scroll orizzontale.

Non caricare il pannello admin nel bundle pubblico.

---

# 41. RESPONSIVE DESIGN

Verifica almeno:

```text
320 × 568
390 × 844
430 × 932
768 × 1024
1024 × 768
1440 × 900
1920 × 1080
```

Controlla:

- hero;
- countdown;
- menu;
- timeline;
- testi lunghi;
- badge lungo;
- modali;
- bottom sheet;
- tastiera mobile;
- form;
- progress bar;
- immagini;
- footer;
- safe area iOS;
- admin;
- tabelle admin;
- nessun overflow.

---

# 42. VARIABILI DI AMBIENTE

Crea `.env.example`.

Contenuto indicativo:

```dotenv
# Public
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_TURNSTILE_SITE_KEY=

# Application
NODE_ENV=development
WEDDING_DEMO_MODE=true
WEDDING_NOINDEX=true

# Database
DATABASE_URL=

# Authentication
AUTH_SECRET=
AUTH_TRUST_HOST=true

# Encryption
DATA_ENCRYPTION_KEY=

# Vercel Blob
BLOB_READ_WRITE_TOKEN=

# Turnstile
TURNSTILE_SECRET_KEY=
TURNSTILE_EXPECTED_HOSTNAME=

# Email, optional
RESEND_API_KEY=
EMAIL_FROM=
ADMIN_NOTIFICATION_EMAIL=

# Security and limits
REQUEST_FINGERPRINT_SECRET=
PUBLIC_FORM_RATE_LIMIT=8
PUBLIC_FORM_RATE_WINDOW_SECONDS=900
MAX_UPLOAD_IMAGE_BYTES=
MAX_UPLOAD_VIDEO_BYTES=
```

Requisiti:

- validazione centralizzata;
- schema distinto server/client;
- nessun secret `NEXT_PUBLIC_*`;
- nessun valore reale nel file example;
- errori leggibili;
- supporto Development, Preview e Production;
- non avviare silenziosamente production con segreti mancanti.

---

# 43. MIGRAZIONI E SEED

Crea comandi:

```text
pnpm db:generate
pnpm db:migrate
pnpm db:check
pnpm db:seed
pnpm db:studio
```

Il seed deve:

- funzionare soltanto quando esplicitamente invocato;
- non sovrascrivere production;
- richiedere conferma in ambiente non-development;
- creare contenuti demo;
- non creare password predefinite;
- essere idempotente quando possibile.

Non eseguire automaticamente migrazioni production durante ogni build Vercel.

Documenta una procedura sicura:

1. creare backup;
2. eseguire migrazione;
3. verificare schema;
4. distribuire applicazione;
5. eseguire smoke test.

---

# 44. PREVIEW DEPLOYMENT

Gestisci gli ambienti Vercel:

```text
Development
Preview
Production
```

Per Preview:

- usa modalità demo oppure database separato;
- non usare automaticamente dati production;
- non inviare email reali;
- usa Turnstile test;
- imposta noindex;
- proteggi l’admin;
- documenta la configurazione.

Per Production:

- demo mode disabilitata;
- database production;
- Blob production;
- secret distinti;
- Turnstile production;
- noindex configurabile;
- email reali soltanto se abilitate.

---

# 45. TEST UNITARI

Copri almeno:

- formattazione valuta;
- countdown futuro;
- countdown senza data;
- countdown trascorso;
- mapping stato pubblico;
- calcolo importo rimanente;
- calcolo importo pending;
- validazione contributo;
- validazione email;
- causale;
- parsing configurazione;
- cifratura e decifratura;
- idempotenza;
- sanitizzazione;
- mapping errori;
- URL validation.

---

# 46. TEST DI INTEGRAZIONE

Usa un database PostgreSQL di test.

Copri:

- prenotazione valida;
- doppia prenotazione;
- richieste simultanee;
- idempotency key duplicata;
- contributo valido;
- contributo superiore al residuo;
- contributi concorrenti;
- conferma contributo;
- doppia conferma;
- cancellazione;
- rimozione lock;
- regalo completato;
- scadenza;
- accesso admin non autorizzato;
- dati bancari non esposti;
- audit log.

Non simulare le race condition soltanto con mock superficiali.

---

# 47. PLAYWRIGHT

Copri almeno:

1. apertura home mobile;
2. navigazione menu;
3. scroll alle sezioni;
4. apertura modal “Regala”;
5. chiusura da tastiera;
6. focus trap;
7. validazione campi;
8. prenotazione riuscita;
9. risposta `409`;
10. contributo riuscito;
11. card regalata senza CTA;
12. data assente;
13. reduced motion;
14. filtri Lista Nozze;
15. login admin;
16. accesso admin non autenticato;
17. modifica programma;
18. modifica regalo;
19. upload media mockato;
20. assenza overflow orizzontale.

Usa chiavi Turnstile di test.

Non usare secret production.

---

# 48. QA VISUALE

Avvia l’app e genera screenshot almeno a:

```text
390 × 844
768 × 1024
1440 × 900
```

Genera screenshot di:

- hero;
- matrimonio;
- programma;
- storia;
- dress code;
- Lista Nozze;
- modal Regala;
- modal Contribuisci;
- login admin;
- dashboard admin;
- editor regalo.

Esamina:

- composizione;
- contrasto;
- leggibilità;
- ritmo;
- spaziature;
- allineamenti;
- badge;
- immagini;
- modali;
- form;
- footer;
- admin;
- assenza di sovrapposizioni;
- assenza di estetica SaaS generica.

Correggi il codice dopo la revisione.

Non considerare completa la UI soltanto perché la build termina.

---

# 49. COMANDI PACKAGE.JSON

Prevedi almeno:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:integration": "...",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "db:generate": "...",
    "db:migrate": "...",
    "db:check": "...",
    "db:seed": "...",
    "db:studio": "...",
    "admin:create": "...",
    "admin:reset-password": "...",
    "admin:list": "...",
    "check": "pnpm lint && pnpm typecheck && pnpm test && pnpm build"
  }
}
```

---

# 50. README

Scrivi `README.md` in italiano.

Deve contenere:

- panoramica;
- architettura;
- stack;
- struttura repository;
- prerequisiti;
- installazione;
- sviluppo locale;
- modalità demo;
- configurazione database;
- creazione database da Vercel Marketplace;
- configurazione Neon;
- migrazioni;
- seed;
- creazione amministratore;
- configurazione Auth.js;
- configurazione Vercel Blob;
- configurazione Turnstile;
- configurazione Resend;
- configurazione cifratura;
- gestione contenuti;
- gestione regali;
- gestione prenotazioni;
- gestione contributi;
- deploy Vercel;
- Preview deployment;
- Production deployment;
- dominio;
- backup;
- privacy;
- sicurezza;
- troubleshooting;
- test;
- sostituzione asset demo;
- procedura di rollback.

Checklist production:

```text
[ ] Data matrimonio configurata
[ ] Cerimonia configurata
[ ] Ricevimento configurato
[ ] Programma verificato
[ ] Fotografie reali caricate
[ ] Video hero ottimizzato
[ ] Testi della storia sostituiti
[ ] Dress code configurato
[ ] Link Maps verificati
[ ] Regali reali caricati
[ ] Link negozi verificati
[ ] IBAN configurato
[ ] Chiave cifratura salvata in modo sicuro
[ ] Privacy verificata
[ ] Turnstile production configurato
[ ] Account amministratore creato
[ ] Password amministrativa verificata
[ ] Email testata
[ ] Noindex confermato o rimosso consapevolmente
[ ] Backup database attivo
[ ] Backup Blob valutato
[ ] Test mobile eseguiti
[ ] Race condition testate
[ ] Migrazioni production completate
[ ] Smoke test production completato
```

---

# 51. AGENTS.MD

Crea un `AGENTS.md` conciso.

Inserisci:

- struttura;
- comandi;
- convenzioni TypeScript;
- convenzioni database;
- convenzioni UI;
- sicurezza;
- accessibilità;
- gestione segreti;
- divieto di WordPress;
- divieto di e-commerce;
- divieto di dati reali nei seed;
- obbligo test;
- criterio di completamento.

Non rendere `AGENTS.md` enorme.

Mantieni al suo interno soltanto istruzioni persistenti utili.

---

# 52. CRITERI DI ACCETTAZIONE

Il task è completato soltanto quando tutte le condizioni seguenti sono vere.

## 52.1 Sito pubblico

- l’app parte con `pnpm dev`;
- la build production termina;
- l’interfaccia è in italiano;
- mostra Gabriele e Giulia;
- la hero è full-screen;
- il countdown funziona;
- l’assenza della data è gestita;
- tutte le sezioni esistono;
- la navigazione one-page funziona;
- il design è originale;
- il sito è mobile-first;
- non esiste overflow;
- i modali sono accessibili;
- i form sono validati;
- gli asset sono ottimizzati;
- il progetto è distribuibile su Vercel.

## 52.2 Lista Nozze

- esistono i tre stati pubblici esatti;
- “Regala” crea una prenotazione persistente;
- “Contribuisci” crea un’intenzione persistente;
- nessun pagamento avviene sul sito;
- il lock è atomico;
- una doppia prenotazione restituisce `409`;
- i contributi concorrenti non superano il residuo;
- la durata predefinita è 48 ore;
- lo sblocco non è automatico;
- l’amministratore può intervenire manualmente;
- i contributi contano soltanto dopo verifica;
- il regalo si completa al raggiungimento del target;
- nessun invitato è visibile pubblicamente;
- l’IBAN non è nel bundle;
- l’idempotenza funziona.

## 52.3 Area amministrativa

- `/admin` è protetto;
- non esiste registrazione pubblica;
- gli amministratori vengono creati via CLI;
- i contenuti sono modificabili;
- i media sono caricabili;
- il programma è riordinabile;
- la storia è modificabile;
- il dress code è modificabile;
- i regali hanno CRUD completo;
- le richieste sono gestibili;
- le azioni sono registrate;
- i dati bancari sono cifrati;
- tutte le pagine admin sono noindex.

## 52.4 Database

- le migrazioni funzionano;
- le foreign key esistono;
- gli importi sono interi;
- i vincoli impediscono stati impossibili;
- le transazioni gestiscono concorrenza;
- il seed è controllato;
- production non dipende da file locali.

## 52.5 Qualità

- lint superato;
- typecheck superato;
- unit test superati;
- integration test principali superati;
- E2E principali superati;
- build superata;
- nessun secret nel repository;
- nessun dato personale nei log;
- nessun errore console rilevante;
- screenshot responsive revisionati;
- README completo.

---

# 53. ORDINE DI IMPLEMENTAZIONE

Procedi in questo ordine:

1. ispezione repository;
2. `PLAN.md`;
3. `AGENTS.md`;
4. scaffold Next.js;
5. design token;
6. monogramma e sistema grafico;
7. modalità demo;
8. homepage completa;
9. sezioni editoriali;
10. Lista Nozze frontend;
11. schema database;
12. migrazioni;
13. autenticazione admin;
14. area amministrativa;
15. gestione media Vercel Blob;
16. prenotazione atomica;
17. contributi atomici;
18. cifratura dati bancari;
19. Turnstile;
20. rate limiting;
21. notifiche opzionali;
22. privacy e security header;
23. caching;
24. test unitari;
25. test integrazione;
26. Playwright;
27. screenshot;
28. QA visuale;
29. correzioni;
30. build production;
31. README finale.

Non saltare:

- database;
- area amministrativa;
- concorrenza;
- accessibilità;
- QA visuale;
- deploy Vercel.

---

# 54. STOPPING RULE

Continua a lavorare finché:

- il progetto compila;
- i flussi principali funzionano;
- i test essenziali passano;
- il sito è visivamente professionale;
- l’area amministrativa è utilizzabile;
- non esistono blocker noti per il deploy Vercel.

Non fermarti al primo risultato compilabile.

Non dichiarare “completo” un elemento non implementato.

Quando una parte non può essere completata per un limite reale dell’ambiente:

1. implementa tutto ciò che è possibile;
2. indica il limite preciso;
3. indica il file interessato;
4. indica il comando da eseguire;
5. indica il risultato atteso;
6. non fingere che il controllo sia stato superato.

---

# 55. OUTPUT FINALE DI CODEX

Al termine fornisci un report concreto con:

1. riepilogo;
2. architettura realizzata;
3. struttura database;
4. file principali;
5. sistema grafico;
6. funzionamento Lista Nozze;
7. funzionamento admin;
8. sicurezza implementata;
9. comandi eseguiti;
10. risultati lint;
11. risultati typecheck;
12. risultati test;
13. risultato build;
14. variabili da configurare;
15. procedura database;
16. procedura Vercel Blob;
17. procedura creazione admin;
18. procedura deploy Vercel;
19. dati demo da sostituire;
20. limiti rimasti.

Non limitarti a scrivere “Fatto”.

Non dichiarare superato un controllo che non hai realmente eseguito.

L’obiettivo finale è una codebase completa, visivamente distintiva, sicura, accessibile e pronta a diventare il sito ufficiale del matrimonio di **Gabriele e Giulia**, interamente gestito e distribuito attraverso Vercel, senza WordPress e senza infrastrutture applicative separate.