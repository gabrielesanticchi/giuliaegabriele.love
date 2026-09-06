const items = [
  ["/admin", "Panoramica"],
  ["/admin/regali", "Lista nozze"],
  ["/admin/richieste", "Richieste"],
  ["/admin/impostazioni", "Impostazioni"]
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
