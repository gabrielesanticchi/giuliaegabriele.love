import { randomUUID } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import type { WeddingDatabase } from "@/db";
import * as transactions from "@/db/transactions";

function queryResult<T>(rows: T[]) {
  const promise = Promise.resolve(rows);
  return {
    limit: () => promise,
    then: promise.then.bind(promise)
  };
}

describe("registry contribution transaction", () => {
  it("persists a contribution without reading or locking a gift", async () => {
    const insertedValues: Array<Record<string, unknown>> = [];
    const stored = {
      id: randomUUID(),
      giftId: null,
      kind: "contribution" as const,
      method: "bank_transfer" as const,
      status: "pending" as const,
      amountCents: 12_500,
      appliedAmountCents: 0,
      replayed: false
    };
    const tx = {
      execute: vi.fn(),
      select: vi.fn(() => ({
        from: vi.fn(() => ({ where: vi.fn(() => queryResult([])) }))
      })),
      insert: vi.fn(() => ({
        values: vi.fn((values: Record<string, unknown>) => {
          insertedValues.push(values);
          return { returning: vi.fn(async () => [stored]) };
        })
      }))
    };
    const db = {
      transaction: vi.fn(
        async (callback: (transaction: typeof tx) => Promise<unknown>) =>
          callback(tx)
      )
    } as unknown as WeddingDatabase;
    const mutation = (
      transactions as unknown as Record<string, unknown>
    ).declareRegistryContribution;

    expect(mutation).toBeTypeOf("function");
    if (typeof mutation !== "function") return;

    const result = await mutation(
      db,
      {
        amountCents: 12_500,
        idempotencyKey: randomUUID(),
        requestFingerprintHash: "a".repeat(64),
        publicReference: `I-${randomUUID()}`,
        guestTokenHash: "b".repeat(64),
        guestDetailsEncrypted: "encrypted-guest-details",
        expiresAt: new Date("2026-09-13T12:00:00.000Z")
      },
      { beforeCommit: vi.fn().mockResolvedValue(undefined) }
    );

    expect(result).toMatchObject(stored);
    expect(insertedValues).toEqual([
      expect.objectContaining({
        giftId: null,
        kind: "contribution",
        method: "bank_transfer",
        amountCents: 12_500
      })
    ]);
    expect(tx.execute).not.toHaveBeenCalled();
  });
});
