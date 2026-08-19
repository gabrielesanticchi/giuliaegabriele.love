import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AdminNavigation } from "@/components/admin/admin-navigation";
import { LogoutButton } from "@/components/admin/logout-button";
import { getAdminPrincipal } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminPanelLayout({
  children
}: {
  children: ReactNode;
}) {
  const principal = await getAdminPrincipal();
  if (!principal?.isActive) redirect("/admin/login");
  if (principal.totpPending) redirect("/admin/totp");
  return (
    <div className="admin-shell">
      <a className="skip-link" href="#admin-content">
        Vai al contenuto
      </a>
      <AdminNavigation />
      <main className="admin-main" id="admin-content">
        <LogoutButton />
        {children}
      </main>
    </div>
  );
}
