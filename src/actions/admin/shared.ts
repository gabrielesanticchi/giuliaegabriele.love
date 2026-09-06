import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";

import { revalidatePath } from "next/cache";
import { sql } from "drizzle-orm";

import { getDatabase, type WeddingDatabase } from "@/db";
import { auditLogs } from "@/db/schema";
import {
  authorizeAdminAction,
  type AdminActionName
} from "@/lib/admin/action-policies";
import { redactAuditMetadata } from "@/lib/admin/audit";
import { getAdminPrincipal } from "@/lib/auth/session";

type AuthDependencies = { getPrincipal: typeof getAdminPrincipal };
const authDependencies = new AsyncLocalStorage<AuthDependencies>();

/** Async-scoped seam used by boundary tests; production defaults remain fixed. */
export function withAdminAuthDependencies<T>(
  dependencies: AuthDependencies,
  callback: () => Promise<T>
): Promise<T> {
  return authDependencies.run(dependencies, callback);
}

export async function authorizedAdmin(action: AdminActionName) {
  const principal = await (
    authDependencies.getStore()?.getPrincipal ?? getAdminPrincipal
  )();
  authorizeAdminAction(action, principal);
  return principal;
}

type AdminTransaction = Parameters<
  Parameters<WeddingDatabase["transaction"]>[0]
>[0];

export async function runAuditedAdminMutation<T>(input: {
  actorAdminId: string;
  action: string;
  targetType: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  mutation: (tx: AdminTransaction) => Promise<T>;
}): Promise<T> {
  return getDatabase().transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext('admin_mutations'))`
    );
    const result = await input.mutation(tx);
    await tx.insert(auditLogs).values({
      actorAdminId: input.actorAdminId,
      actorType: "admin",
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      metadata: redactAuditMetadata(input.metadata ?? {}) as Record<
        string,
        unknown
      >
    });
    return result;
  });
}

export function refreshAdmin(path: string) {
  revalidatePath(path);
  revalidatePath("/");
}

export type AdminActionResult =
  { ok: true; message: string } | { ok: false; message: string };
