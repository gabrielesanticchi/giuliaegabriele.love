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
      <p className="lead">
        Questa informativa è in preparazione e sarà verificata prima della
        pubblicazione del sito.
      </p>
      <section aria-labelledby="privacy-contact">
        <h2 id="privacy-contact">Prima della pubblicazione</h2>
        <p>
          Il sito non raccoglie richieste degli invitati finché i flussi della
          Lista Nozze e l’informativa completa non saranno attivi.
        </p>
      </section>
    </main>
  );
}
