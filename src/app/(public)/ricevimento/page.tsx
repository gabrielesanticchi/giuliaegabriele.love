import type { Metadata } from "next";

import { PublicHome } from "@/components/sections/public-home";
import { siteContent } from "@/data/site-content";
import { loadPublicGiftsSafely } from "@/lib/public-content/adapter";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Giulia & Gabriele · Ricevimento",
  description: "I dettagli della giornata di Giulia e Gabriele.",
  alternates: { canonical: "/ricevimento" },
  robots: { index: false, follow: false }
};

export default async function ReceptionPage() {
  const gifts = await loadPublicGiftsSafely();
  return <PublicHome content={{ ...siteContent, gifts }} includeReception />;
}
