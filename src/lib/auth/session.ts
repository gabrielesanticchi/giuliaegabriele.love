import "server-only";

import { getServerSession } from "next-auth";

import { authOptions } from "../../../auth";
import {
  assertAdminPrincipal,
  type AdminPrincipal,
  type AdminRole,
  validateAdminSession
} from "./authorization";
import { loadAdminPrincipal } from "./repository";

export async function getAdminPrincipal(): Promise<AdminPrincipal | null> {
  const session = await getServerSession(authOptions);
  const user = session?.user;
  if (!user?.adminId || !user.role || !user.sessionVersion) return null;
  return validateAdminSession(
    {
      adminId: user.adminId,
      role: user.role,
      sessionVersion: user.sessionVersion
    },
    loadAdminPrincipal
  );
}

export async function requireAdmin(
  requiredRole: AdminRole = "editor",
  options: { allowTotpPending?: boolean } = {}
): Promise<AdminPrincipal> {
  const principal = await getAdminPrincipal();
  assertAdminPrincipal(principal, requiredRole, options);
  return principal;
}
