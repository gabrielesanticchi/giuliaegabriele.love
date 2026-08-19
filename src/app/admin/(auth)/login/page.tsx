import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginForm } from "@/components/admin/login-form";

export const metadata: Metadata = {
  title: "Accesso amministrazione",
  robots: { index: false, follow: false }
};

export default function AdminLoginPage() {
  return (
    <main className="admin-login">
      <section className="admin-login-panel">
        <p className="eyebrow">Area riservata</p>
        <h1>Amministrazione</h1>
        <p>Contenuti, richieste e pubblicazione del sito.</p>
        <Suspense fallback={<p>Caricamento…</p>}>
          <LoginForm />
        </Suspense>
      </section>
    </main>
  );
}
