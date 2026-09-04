export interface MonogramProps {
  className?: string;
  title?: string;
}

/**
 * Stemma del matrimonio: il logo dei subacquei (G & G, 24 Ottobre 2026)
 * reso come maschera tinta in arancio bruciato, così da adattarsi a
 * qualsiasi sfondo ereditando il colore dai token del sito.
 */
export function Monogram({
  className,
  title = "Logo di Giulia e Gabriele"
}: MonogramProps) {
  return (
    <span
      className={`monogram${className ? ` ${className}` : ""}`}
      role="img"
      aria-label={title}
    />
  );
}
