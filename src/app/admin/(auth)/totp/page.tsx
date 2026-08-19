import type { Metadata } from "next";

import { TotpEnrollment } from "@/components/admin/totp-enrollment";
import { requireAdmin } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Configura autenticazione a due fattori",
  robots: { index: false, follow: false }
};

export default async function TotpPage() {
  await requireAdmin("editor", { allowTotpPending: true });
  return (
    <main className="admin-login">
      <section className="admin-login-panel">
        <p className="eyebrow">Protezione account</p>
        <h1>Autenticazione a due fattori</h1>
        <p>In produzione questa configurazione è obbligatoria.</p>
        <TotpEnrollment />
      </section>
    </main>
  );
}
