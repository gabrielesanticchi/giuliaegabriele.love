import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Giulia & Gabriele",
    short_name: "G & G",
    description: "Il matrimonio di Giulia e Gabriele, 24 ottobre 2026.",
    lang: "it",
    start_url: "/",
    display: "standalone",
    background_color: "#f3ede2",
    theme_color: "#20342c",
    icons: [
      {
        src: "/graphics/monogram-mark.svg",
        sizes: "any",
        type: "image/svg+xml"
      }
    ]
  };
}
