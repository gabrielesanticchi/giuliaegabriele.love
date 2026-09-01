import { formatCurrency } from "@/lib/domain/currency";
import { loadDashboardSummary } from "@/lib/admin/queries";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const summary = await loadDashboardSummary();
  const cards = [
    ["Regali", String(summary.giftCount)],
    ["Richieste", String(summary.intentCount)],
    ["Scadute", String(summary.expiredCount)],
    ["Valore richiesto", formatCurrency(summary.requestedEuros)],
    ["Valore ricevuto", formatCurrency(summary.receivedEuros)],
    ["Valore applicato", formatCurrency(summary.appliedEuros)]
  ];
  return (
    <>
      <header className="admin-page-header">
        <div>
          <p className="eyebrow">Panoramica</p>
          <h1>Il sito, in breve</h1>
        </div>
        <div>
          <a className="admin-action" href="/admin/preview">
            Anteprima
          </a>{" "}
          <a className="admin-action" href="/admin/impostazioni">
            Pubblica il sito
          </a>
        </div>
      </header>
      <section className="admin-grid" aria-label="Indicatori principali">
        {cards.map(([label, value]) => (
          <article className="admin-card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>
      <section className="admin-editor">
        <p className="eyebrow">Attività recente</p>
        <h2>Ultime richieste</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Riferimento</th>
              <th>Stato</th>
              <th>Importo</th>
              <th>Data</th>
            </tr>
          </thead>
          <tbody>
            {summary.recent.map((item) => (
              <tr key={item.id}>
                <td>{item.reference}</td>
                <td>{item.status}</td>
                <td>{formatCurrency(item.amountEuros)}</td>
                <td>{item.createdAt.toLocaleDateString("it-IT")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
