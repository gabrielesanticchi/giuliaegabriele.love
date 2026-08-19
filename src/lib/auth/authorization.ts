import "server-only";

export type AdminRole = "owner" | "editor";

export type AdminPrincipal = {
  id: string;
  role: AdminRole;
  sessionVersion: number;
  isActive: boolean;
  totpPending: boolean;
};

export type AdminTokenClaims = {
  adminId: string;
  role: AdminRole;
  sessionVersion: number;
};

export class AdminAuthorizationError extends Error {
  readonly status = 403;

  constructor(message = "Accesso amministratore richiesto") {
    super(message);
    this.name = "AdminAuthorizationError";
  }
}

export async function validateAdminSession(
  claims: AdminTokenClaims | null,
  loadAdmin: (adminId: string) => Promise<AdminPrincipal | null>
): Promise<AdminPrincipal | null> {
  if (!claims) return null;
  const admin = await loadAdmin(claims.adminId);
  if (
    !admin?.isActive ||
    admin.sessionVersion !== claims.sessionVersion ||
    admin.role !== claims.role
  ) {
    return null;
  }
  return admin;
}

export function assertAdminPrincipal(
  principal: AdminPrincipal | null,
  requiredRole: AdminRole = "editor",
  options: { allowTotpPending?: boolean } = {}
): asserts principal is AdminPrincipal {
  if (!principal?.isActive) throw new AdminAuthorizationError();
  if (principal.totpPending && !options.allowTotpPending) {
    throw new AdminAuthorizationError("Configurazione TOTP richiesta");
  }
  if (requiredRole === "owner" && principal.role !== "owner") {
    throw new AdminAuthorizationError("Permessi insufficienti");
  }
}
