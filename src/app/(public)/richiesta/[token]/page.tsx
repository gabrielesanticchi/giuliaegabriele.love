import type { Metadata } from "next";

import { Monogram } from "@/components/graphics/monogram";

import { loadGuestRequest } from "./data";
import { GuestRequestView } from "./guest-request-view";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "La tua richiesta | Gabriele & Giulia",
  robots: { index: false, follow: false }
};

export default async function GuestRequestPage({
  params
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const request = await loadGuestRequest(token);

  if (!request) {
    return (
      <main className="guest-request-page" id="contenuto">
        <section>
          <Monogram />
          <p className="eyebrow">Lista nozze</p>
          <h1>Link non disponibile</h1>
          <p>
            Il collegamento non è valido oppure non è più attivo. Contatta
            Gabriele e Giulia se hai bisogno di aiuto.
          </p>
          <a href="/">Torna al sito</a>
        </section>
      </main>
    );
  }

  return <GuestRequestView request={request} />;
}
