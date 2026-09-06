import { Monogram } from "@/components/graphics/monogram";

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <a className="back-link" href="/">
        ← Torna al sito
      </a>
      <Monogram />
      <p className="eyebrow">Informativa</p>
      <h1>Privacy</h1>
      <p>Aggiornata il 5 settembre 2026 — versione 2026-09-05</p>
      <p className="lead">
        La Lista Nozze usa soltanto i dati necessari a registrare e gestire le
        richieste degli invitati.
      </p>
      <section aria-labelledby="privacy-controller">
        <h2 id="privacy-controller">Titolari e contatti</h2>
        <p>
          I titolari del trattamento sono Giulia e Gabriele. Potete contattarci
          attraverso gli stessi recapiti con cui avete ricevuto l’invito al
          matrimonio.
        </p>
      </section>
      <section aria-labelledby="privacy-data">
        <h2 id="privacy-data">Dati e finalità</h2>
        <p>
          Quando inviate una richiesta raccogliamo nome, cognome, numero di
          telefono, l’eventuale messaggio e i dettagli del regalo o contributo.
          Li utilizziamo per evitare richieste duplicate, contattarvi se
          necessario e verificare manualmente acquisti e bonifici. Il sito non
          gestisce pagamenti online.
        </p>
      </section>
      <section aria-labelledby="privacy-basis">
        <h2 id="privacy-basis">Base giuridica e conferimento</h2>
        <p>
          Trattiamo i dati sulla base del consenso espresso selezionando la
          casella presente nel modulo. Il conferimento è facoltativo, ma senza i
          dati richiesti non possiamo registrare o gestire la richiesta. Potete
          revocare il consenso in qualsiasi momento, senza pregiudicare i
          trattamenti già effettuati.
        </p>
      </section>
      <section aria-labelledby="privacy-recipients">
        <h2 id="privacy-recipients">Destinatari</h2>
        <p>
          I dati sono consultati da Giulia e Gabriele e possono essere trattati
          dai fornitori tecnici necessari al funzionamento del sito, del
          database e delle comunicazioni email, che operano come responsabili
          del trattamento secondo i rispettivi accordi. Non vendiamo né
          diffondiamo i dati degli invitati.
        </p>
      </section>
      <section aria-labelledby="privacy-retention">
        <h2 id="privacy-retention">Conservazione</h2>
        <p>
          Conserviamo i dati per il tempo necessario alla gestione della Lista
          Nozze e delle verifiche collegate; successivamente li cancelliamo,
          salvo il tempo ulteriore necessario per obblighi di legge o per la
          tutela di eventuali diritti.
        </p>
      </section>
      <section aria-labelledby="privacy-rights">
        <h2 id="privacy-rights">I vostri diritti</h2>
        <p>
          Potete chiedere accesso, rettifica, cancellazione, limitazione del
          trattamento e portabilità dei dati, oltre a revocare il consenso,
          usando i contatti indicati sopra. Potete inoltre proporre reclamo al{" "}
          <a href="https://www.garanteprivacy.it/" rel="noopener noreferrer">
            Garante per la protezione dei dati personali
          </a>
          . Non utilizziamo processi decisionali automatizzati o profilazione.
        </p>
      </section>
    </main>
  );
}
