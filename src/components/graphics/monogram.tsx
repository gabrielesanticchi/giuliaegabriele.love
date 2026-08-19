export interface MonogramProps {
  className?: string;
  title?: string;
}

export function Monogram({
  className,
  title = "Monogramma Gabriele e Giulia"
}: MonogramProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 120 120"
      role="img"
      aria-label={title}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="60" cy="60" r="52" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M58 36c-5-8-20-8-28 2-10 13-7 36 8 44 10 5 21 1 25-7V59H47"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M62 36c5-8 20-8 28 2 10 13 7 36-8 44-10 5-21 1-25-7V59h16"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M25 91c14-7 26-5 35 5 9-10 21-12 35-5M60 96v13"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M87 27c5-4 10-5 15-3-1 6-5 10-11 11M33 27c-5-4-10-5-15-3 1 6 5 10 11 11"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
