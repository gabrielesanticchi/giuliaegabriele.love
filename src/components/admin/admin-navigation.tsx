const items = [
  ["/admin", "Panoramica"],
  ["/admin/sito", "Sito e Hero"],
  ["/admin/matrimonio", "Il matrimonio"],
  ["/admin/programma", "Programma"],
  ["/admin/storia", "La nostra storia"],
  ["/admin/dress-code", "Dress code"],
  ["/admin/regali", "Lista nozze"],
  ["/admin/richieste", "Richieste"],
  ["/admin/media", "Media"],
  ["/admin/impostazioni", "Impostazioni"],
  ["/admin/audit", "Audit log"]
] as const;

export function AdminNavigation() {
  return (
    <nav className="admin-nav" aria-label="Amministrazione">
      <p className="admin-brand">
        Giulia <i>&amp;</i> Gabriele
      </p>
      <ul>
        {items.map(([href, label]) => (
          <li key={href}>
            <a href={href}>{label}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
