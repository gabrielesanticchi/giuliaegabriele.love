import type { Metadata } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import type { ReactNode } from "react";

import "@/styles/globals.css";

const displayFont = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap"
});

const bodyFont = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap"
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
  "https://giuliaegabriele.love";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Gabriele & Giulia",
  description: "Il matrimonio di Gabriele e Giulia, 24 ottobre 2026.",
  applicationName: "Gabriele & Giulia",
  robots: { index: false, follow: false },
  icons: { icon: "/graphics/monogram-mark.svg" },
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "it_IT",
    siteName: "Gabriele & Giulia",
    title: "Gabriele & Giulia",
    description: "Il matrimonio di Gabriele e Giulia, 24 ottobre 2026.",
    url: siteUrl
  }
};

export default function RootLayout({
  children
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="it" className={`${displayFont.variable} ${bodyFont.variable}`}>
      <body>{children}</body>
    </html>
  );
}
