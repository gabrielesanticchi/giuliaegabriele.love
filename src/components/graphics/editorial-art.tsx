export interface EditorialArtProps {
  label: string;
  variant?: "arch" | "leaf" | "path";
}

export function EditorialArt({ label, variant = "path" }: EditorialArtProps) {
  return (
    <div
      className={`editorial-art editorial-art--${variant}`}
      role="img"
      aria-label={label}
    >
      <svg viewBox="0 0 640 720" aria-hidden="true" focusable="false">
        <path
          className="art-contour"
          d="M-20 580c110-190 214-4 332-154 97-123 161-35 348-207"
        />
        <path
          className="art-contour art-contour--soft"
          d="M-20 627c129-184 239-12 355-155 82-101 160-45 325-196"
        />
        <path
          className="art-arch"
          d="M182 584V303c0-99 62-171 138-171s138 72 138 171v281"
        />
        <path
          className="art-stem"
          d="M321 552c-35-74-54-145-36-241M291 357c-41-20-62-50-69-88M286 405c42-28 74-61 91-104"
        />
        <path
          className="art-leaf"
          d="M222 269c36 0 63 17 72 51-38 2-63-14-72-51ZM377 301c-4 39-25 64-61 70 4-37 24-61 61-70Z"
        />
      </svg>
    </div>
  );
}
