export interface EditorialArtProps {
  label: string;
  variant?: "arch" | "leaf" | "path";
}

/**
 * Motivo decorativo del sito: la manta (line-art) resa come maschera tinta,
 * così eredita il colore dal contenitore e si adatta a fondi chiari o scuri.
 */
export function EditorialArt({ label, variant = "path" }: EditorialArtProps) {
  return (
    <div
      className={`editorial-art editorial-art--${variant}`}
      role="img"
      aria-label={label}
    >
      <span className="editorial-art-motif" aria-hidden="true" />
    </div>
  );
}
