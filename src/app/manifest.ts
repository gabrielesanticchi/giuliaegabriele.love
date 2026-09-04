import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Giulia & Gabriele",
    short_name: "G & G",
    description: "Il matrimonio di Giulia e Gabriele, 24 ottobre 2026.",
    lang: "it",
    start_url: "/",
    display: "standalone",
    background_color: "#f4ebdd",
    theme_color: "#c86a3a",
    icons: [
      {
        src: "/graphics/logo-couple.png",
        sizes: "any",
        type: "image/png"
      }
    ]
  };
}
