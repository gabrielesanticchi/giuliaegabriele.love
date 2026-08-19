import "server-only";

import { revalidatePath, revalidateTag } from "next/cache";

import { getDatabase, type WeddingDatabase } from "@/db";
import { auditLogs } from "@/db/schema";
import {
  authorizeAdminAction,
  type AdminActionName
} from "@/lib/admin/action-policies";
import { redactAuditMetadata } from "@/lib/admin/audit";
import { getAdminPrincipal } from "@/lib/auth/session";

export async function authorizedAdmin(action: AdminActionName) {
  const principal = await getAdminPrincipal();
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
  revalidateTag("public-content", "max");
}

export type AdminActionResult =
  { ok: true; message: string } | { ok: false; message: string };
