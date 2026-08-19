"use client";

import { signOut } from "next-auth/react";

export function LogoutButton() {
  return (
    <button
      type="button"
      className="admin-logout"
      onClick={() => signOut({ callbackUrl: "/admin/login" })}
    >
      Esci
    </button>
  );
}
