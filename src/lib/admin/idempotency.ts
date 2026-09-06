import "server-only";

import { createHash } from "node:crypto";

import { and, eq, sql } from "drizzle-orm";

import { getDatabase, type WeddingDatabase } from "@/db";
import { adminActionReceipts, auditLogs } from "@/db/schema";
import { redactAuditMetadata } from "@/lib/admin/audit";

export type AdminTransaction = Parameters<
  Parameters<WeddingDatabase["transaction"]>[0]
>[0];

type Audit = {
  action: string;
  targetType: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
};

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(
      ([left], [right]) => left.localeCompare(right)
    );
    return `{${entries
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableJson(nested)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * Claims the logical operation and commits its database effect, audit row and
 * completed receipt together. A thrown callback rolls all three back.
 */
export async function runAdminIdempotentTransaction<
  T extends Record<string, unknown>
>(input: {
  actorAdminId: string;
  action: string;
  entityId: string;
  idempotencyKey: string;
  payload: unknown;
  effect: (tx: AdminTransaction) => Promise<T>;
  audit?: (result: T) => Audit | undefined;
  db?: WeddingDatabase;
}): Promise<{ result: T; replayed: boolean }> {
  const db = input.db ?? getDatabase();
  const payloadHash = createHash("sha256")
    .update(stableJson(input.payload))
    .digest("hex");
  const logicalKey = [
    input.actorAdminId,
    input.action,
    input.entityId,
    input.idempotencyKey
  ].join(":");

  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${logicalKey}, 0))`
    );
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext('admin_mutations'))`
    );
    const existing = await tx
      .select()
      .from(adminActionReceipts)
      .where(
        and(
          eq(adminActionReceipts.actorAdminId, input.actorAdminId),
          eq(adminActionReceipts.action, input.action),
          eq(adminActionReceipts.entityId, input.entityId),
          eq(adminActionReceipts.idempotencyKey, input.idempotencyKey)
        )
      )
      .limit(1);
    const receipt = existing[0];
    if (receipt) {
      if (receipt.payloadHash !== payloadHash)
        throw new Error("Chiave idempotenza riutilizzata con payload diverso");
      if (receipt.status === "completed")
        return { result: receipt.result as T, replayed: true };
      if (Date.now() - receipt.createdAt.getTime() <= 300_000)
        throw new Error("Operazione già in corso");
      // Legacy pending rows are reclaimed by exact primary key while the
      // logical advisory lock is held; never delete a concurrent claim.
      await tx
        .delete(adminActionReceipts)
        .where(eq(adminActionReceipts.id, receipt.id));
    }

    const inserted = await tx
      .insert(adminActionReceipts)
      .values({
        actorAdminId: input.actorAdminId,
        action: input.action,
        entityId: input.entityId,
        idempotencyKey: input.idempotencyKey,
        payloadHash,
        status: "pending",
        result: { state: "started" }
      })
      .returning({ id: adminActionReceipts.id });
    if (!inserted[0]) throw new Error("Receipt non creata");

    const result = await input.effect(tx);
    const audit = input.audit?.(result);
    if (audit) {
      await tx.insert(auditLogs).values({
        actorAdminId: input.actorAdminId,
        actorType: "admin",
        action: audit.action,
        targetType: audit.targetType,
        targetId: audit.targetId,
        metadata: redactAuditMetadata(audit.metadata ?? {}) as Record<
          string,
          unknown
        >
      });
    }
    await tx
      .update(adminActionReceipts)
      .set({ result, status: "completed" })
      .where(eq(adminActionReceipts.id, inserted[0].id));
    return { result, replayed: false };
  });
}
