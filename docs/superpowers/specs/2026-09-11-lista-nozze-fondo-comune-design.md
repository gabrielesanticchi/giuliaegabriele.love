# Lista Nozze con fondo comune e revisione tipografica

Data: 11 settembre 2026

## Stato

Approvato a livello funzionale, in attesa di revisione della specifica.

## Obiettivo

Riorganizzare la home page e la Lista Nozze affinché:

- l'hero dia maggiore risalto a “Ci sposiamo” e presenti i nomi su tre righe;
- le etichette numerate delle sezioni siano più leggibili;
- ogni oggetto della lista possa essere regalato soltanto per intero, tramite
  acquisto sul sito del negozio oppure tramite bonifico;
- i contributi di importo libero confluiscano in un unico fondo comune, senza
  modificare disponibilità o avanzamento dei singoli oggetti.

Non vengono introdotti pagamenti online. IBAN e dati personali mantengono le
protezioni attuali.

## Decisione architetturale

Il fondo comune sarà rappresentato come una contribuzione senza `gift_id`,
anziché come un regalo fittizio. Il modello alternativo con regalo nascosto è
stato scartato perché imporrebbe un prezzo artificiale, produrrebbe stati
fuorvianti e manterrebbe un accoppiamento che la nuova esperienza vuole
eliminare.

`gift_intents.kind = 'full_gift'` continuerà a indicare un regalo intero e
richiederà un `gift_id`. `gift_intents.kind = 'contribution'` indicherà invece
il fondo comune e avrà `gift_id = NULL`.

La migrazione:

1. rende nullable `gift_intents.gift_id`;
2. sposta nel fondo comune anche le contribuzioni storiche impostando
   `gift_id = NULL` per tutte le righe con `kind = 'contribution'`;
3. aggiunge un vincolo che vieta un `full_gift` senza regalo;
4. conserva importi, stato, riferimenti, dati cifrati, ricevute ed email
   esistenti.

Le contribuzioni storiche non concorreranno più al completamento di un oggetto.
Restano consultabili e verificabili come contributi al fondo comune.

## Hero e gerarchia tipografica

Il titolo principale rimane un unico `h1`, con nome accessibile “Giulia e
Gabriele”, ma viene composto visivamente con tre righe:

1. `Giulia`;
2. `e`;
3. `Gabriele`.

Le due righe dei nomi useranno circa un terzo dell'attuale dimensione massima;
la `e` sarà ulteriormente ridotta. La composizione su tre righe manterrà
l'altezza complessiva equilibrata e non dovrà creare overflow a 320 px.

“Ci sposiamo” avrà una dimensione circa doppia rispetto agli attuali `0.72rem`,
con spaziatura tra lettere adattata per non uscire dallo schermo.

Saranno ingrandite almeno del doppio esclusivamente le etichette principali:

- “Il matrimonio · 01”;
- “La nostra storia · 02”;
- “Lista nozze · 03”.

Le eyebrow interne, come categoria, capitolo e dialog, manterranno la scala
attuale.

## Blocco del fondo comune

Il blocco sarà collocato dopo l'introduzione della Lista Nozze e prima dei
filtri e delle schede. Su schermi ampi avrà illustrazione a sinistra e contenuto
a destra; su mobile diventerà una colonna.

L'illustrazione sarà un asset raster originale con sfondo trasparente: un
salvadanaio a forma di maialino, coerente con la palette del sito, nel quale sta
cadendo un piccolo mattone al posto della moneta. Non conterrà testo, marchi o
watermark e sarà salvata come
`public/graphics/wedding-fund-piggy-bank.png`.

Il contenuto userà questo significato editoriale:

> Contribuisci facendo un piccolo regalo per la nostra casa. Ti comunicheremo
> nelle prossime settimane a che cosa avrà contribuito il regalo che ci hai
> fatto con tanto amore.

La CTA sarà “Contribuisci”. Aprirà il form esistente per nome, cognome,
telefono, messaggio facoltativo, importo in euro interi e consenso privacy.
L'unico metodo sarà il bonifico.

## Schede dei regali

Le schede continueranno a mostrare immagine, categoria, nome, descrizione e
stato, ma non mostreranno:

- prezzo di listino;
- barra o percentuale di avanzamento;
- CTA “Contribuisci”;
- link separato “Vedi il prodotto”.

Per un regalo disponibile, l'ordine delle azioni sarà:

1. “Regala tramite acquisto sul sito”;
2. “Regala tramite bonifico”.

Se un regalo non ha un `product_url` HTTPS valido, la prima azione non sarà
mostrata e resterà disponibile il bonifico. Le schede riservate o regalate non
offriranno azioni.

Lo stato pubblico di un regalo dipenderà unicamente da `completed` e dal lock di
una prenotazione intera. Le contribuzioni al fondo comune non avranno alcun
effetto sul regalo.

## Acquisto sul sito del negozio

“Regala tramite acquisto sul sito” non creerà richieste, lock o dati personali.
Aprirà prima un dialog accessibile che:

- spiega che il sito del negozio si aprirà in una nuova scheda;
- chiede di comunicare l'acquisto a Giulia o Gabriele tramite WhatsApp affinché
  il regalo possa essere rimosso dalla lista;
- non mostra numeri telefonici, link WhatsApp o altri dati personali;
- offre “Continua sul sito del negozio” e “Annulla”.

La conferma aprirà esclusivamente il `product_url` HTTPS già validato, con le
protezioni `noopener` e `noreferrer`. Alla chiusura del dialog, il focus tornerà
alla CTA che lo ha aperto.

Il regalo resterà visibile fino all'intervento manuale dell'amministratore.
Esiste quindi una finestra temporale nella quale due ospiti potrebbero
acquistarlo; il warning e la comunicazione telefonica riducono ma non eliminano
questo rischio.

## Regalo tramite bonifico

“Regala tramite bonifico” continuerà a creare una prenotazione esclusiva di 48
ore per l'intero regalo. Il dialog:

- mostrerà `Prezzo di listino pieno: <importo>`;
- non mostrerà più la scelta tra bonifico e acquisto esterno;
- raccoglierà gli stessi dati e consensi attuali;
- invierà sempre `method = 'bank_transfer'`;
- mostrerà l'IBAN soltanto nella prima risposta `no-store`, mai nelle GET o nei
  replay.

L'importo persistito sarà sempre il prezzo intero del regalo. Verifica, lock,
scadenza, idempotenza, pagina personale e audit manterranno le invarianti
esistenti.

## API e transazioni

La prenotazione intera resterà su
`POST /api/gifts/[giftId]/reserve`. Lo schema della richiesta continuerà ad
accettare il metodo, ma l'interfaccia pubblica invierà soltanto
`bank_transfer`; la mutation manterrà il controllo che l'importo corrisponda al
prezzo del regalo.

Il vecchio endpoint per contribuzioni legate a un regalo,
`POST /api/gifts/[giftId]/contribute`, verrà rimosso. Il nuovo endpoint sarà:

`POST /api/registry/contribute`

Accetterà lo stesso payload protetto oggi usato per i contributi: ospite,
privacy, honeypot, idempotency key e `amountCents`. Applicherà origin check,
limite del body, rate limit, cifratura, fingerprint e risposta `no-store`.

La nuova transazione `declareRegistryContribution`:

- non leggerà né bloccherà alcun regalo;
- inserirà un intent `contribution`, `bank_transfer`, `gift_id = NULL`;
- non applicherà un tetto derivato dal prezzo di un regalo;
- manterrà l'importo massimo pubblico già previsto dalla validazione;
- userà un riferimento causale del fondo comune, separato dai riferimenti dei
  regali;
- non creerà righe in `gift_locks`.

La verifica admin distinguerà i due tipi:

- `full_gift`: verifica l'importo, completa il regalo e rimuove il lock;
- `contribution`: verifica e applica l'importo alla sola richiesta, senza
  aggiornare `gifts`.

## Admin, email e pagina personale

Richieste, dashboard, esportazione CSV, email e pagina personale useranno il
titolo virtuale “Fondo comune Lista Nozze” quando `gift_id` è nullo.

Le query che oggi effettuano un join obbligatorio con `gifts` useranno un left
join o un fallback esplicito. I testi delle email di contribuzione non diranno
più che l'importo è associato a un oggetto, ma che è destinato al fondo comune.

L'archiviazione già disponibile nell'admin resterà il modo per rimuovere dalla
lista un regalo acquistato sul negozio. Non verrà creata una mutation pubblica
basata sulla sola comunicazione telefonica.

L'inserimento manuale admin consentirà:

- un regalo intero con regalo obbligatorio;
- una contribuzione al fondo comune senza regalo.

## Accessibilità e responsive

- Tutti i dialog useranno titolo e descrizione associati, focus iniziale
  prevedibile, chiusura da tastiera e ripristino del focus.
- Le CTA avranno un'area interattiva minima di 44 px.
- L'illustrazione decorativa avrà alt vuoto; il significato sarà espresso nel
  testo adiacente.
- Il layout sarà verificato a 320 px senza overflow.
- Le animazioni rispetteranno `prefers-reduced-motion`.
- L'avviso non includerà numeri telefonici o altri dati personali.

## Strategia di test

L'implementazione seguirà TDD con test fallenti osservati prima di ogni modifica
funzionale.

Test unitari e di componente:

- struttura accessibile dell'hero e tre righe visuali;
- scope dell'ingrandimento delle etichette di sezione;
- assenza di prezzo, avanzamento, “Contribuisci” e “Vedi il prodotto” dalle
  schede;
- ordine e disponibilità delle due CTA;
- warning dell'acquisto esterno, copy WhatsApp, URL sicuro e focus;
- prezzo pieno nel dialog del bonifico e metodo fissato;
- blocco del fondo comune e payload del nuovo endpoint;
- adapter pubblico indipendente dalle contribuzioni;
- handler e transazione del fondo comune, inclusi errori, idempotenza e
  sicurezza;
- email, pagina personale e query admin con `gift_id = NULL`;
- verifica admin che non aggiorna un regalo per una contribuzione comune.

Test di schema e integrazione, quando `TEST_DATABASE_URL` è disponibile:

- migrazione e nullabilità di `gift_id`;
- vincolo `full_gift` → `gift_id` obbligatorio;
- conversione delle contribuzioni storiche;
- concorrenza e idempotenza delle contribuzioni comuni;
- invarianti transazionali di verifica e audit.

Verifica finale applicativa:

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm format:check
pnpm db:check
```

Gli integration test saranno dichiarati eseguiti soltanto se è configurato un
vero `TEST_DATABASE_URL`. E2E e controlli axe saranno eseguiti se browser e
server richiesti sono disponibili.

## Fuori ambito

- Pagamenti online o integrazioni bancarie.
- Conferma automatica degli acquisti effettuati sul negozio.
- Invio automatico di SMS o messaggi WhatsApp.
- Deploy, provisioning cloud, modifica DNS o applicazione della migrazione a un
  database remoto.
