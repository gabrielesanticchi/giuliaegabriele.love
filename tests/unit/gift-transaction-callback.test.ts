import { randomUUID } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import type { WeddingDatabase } from "@/db";
import {
  declareRegistryContribution,
  reserveGift,
  type GiftMutationResult
} from "@/db/transactions";

type MutationInput = {
  giftId: string;
  idempotencyKey: string;
  publicReference: string;
  method: "bank_transfer";
  amountCents: number;
  requestFingerprintHash: string;
  guestTokenHash: string;
  guestDetailsEncrypted: string;
  expiresAt: Date;
};

type MutationWithBoundary = (
  db: WeddingDatabase,
  input: MutationInput,
  options: { beforeCommit: () => Promise<void> }
) => Promise<GiftMutationResult>;

const operations = [
  {
    name: "reserveGift",
    mutation: reserveGift as MutationWithBoundary,
    hasGiftLock: true
  },
  {
    name: "declareRegistryContribution",
    mutation: declareRegistryContribution as MutationWithBoundary,
    hasGiftLock: false
  }
] as const;

function input(amountCents = 10_000): MutationInput {
  return {
    giftId: randomUUID(),
    idempotencyKey: randomUUID(),
    publicReference: `I-${randomUUID()}`,
    method: "bank_transfer",
    amountCents,
    requestFingerprintHash: "a".repeat(64),
    guestTokenHash: "b".repeat(64),
    guestDetailsEncrypted: "encrypted-guest-details",
    expiresAt: new Date("2026-08-21T12:00:00.000Z")
  };
}

function queryResult<T>(rows: T[]) {
  const promise = Promise.resolve(rows);
  return {
    limit: () => promise,
    then: promise.then.bind(promise)
  };
}

function fakeDatabase(options: {
  kind: "reserve" | "contribute";
  replay?: boolean;
  mutationInput: MutationInput;
}) {
  const events: string[] = [];
  const intent = {
    id: randomUUID(),
    ...options.mutationInput,
    giftId: options.kind === "reserve" ? options.mutationInput.giftId : null,
    kind: options.kind === "reserve" ? "full_gift" : "contribution",
    status: "pending",
    appliedAmountCents: 0
  };
  const selectResults: unknown[][] = options.replay
    ? [[intent]]
    : options.kind === "reserve"
      ? [
          [],
          [
            {
              id: options.mutationInput.giftId,
              completed: false,
              published: true,
              archivedAt: null,
              priceCents: options.mutationInput.amountCents
            }
          ],
          []
        ]
      : [[]];
  let selectIndex = 0;

  const tx = {
    execute: vi.fn(async () => {
      events.push("lock-gift");
    }),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => queryResult(selectResults[selectIndex++] ?? []))
      }))
    })),
    insert: vi.fn(() => ({
      values: vi.fn((value: Record<string, unknown>) => {
        if ("kind" in value) {
          events.push("insert-intent");
          return { returning: vi.fn(async () => [intent]) };
        }
        events.push("insert-gift-lock");
        return Promise.resolve();
      })
    }))
  };
  const db = {
    transaction: vi.fn(
      async (callback: (transaction: typeof tx) => Promise<unknown>) => {
        events.push("begin");
        try {
          const result = await callback(tx);
          events.push("commit");
          return result;
        } catch (error) {
          events.push("rollback");
          throw error;
        }
      }
    )
  } as unknown as WeddingDatabase;

  return { db, events };
}

describe("gift transaction beforeCommit boundary", () => {
  it.each(operations)(
    "$name esegue beforeCommit dopo le scritture e prima del commit",
    async ({ mutation, hasGiftLock }) => {
      const mutationInput = input(hasGiftLock ? 10_000 : 3_000);
      const { db, events } = fakeDatabase({
        kind: hasGiftLock ? "reserve" : "contribute",
        mutationInput
      });

      const result = await mutation(db, mutationInput, {
        beforeCommit: async () => {
          events.push("before-commit");
        }
      });

      expect(result.replayed).toBe(false);
      expect(events).toEqual(
        hasGiftLock
          ? [
              "begin",
              "lock-gift",
              "insert-intent",
              "insert-gift-lock",
              "before-commit",
              "commit"
            ]
          : ["begin", "insert-intent", "before-commit", "commit"]
      );
    }
  );

  it.each(operations)(
    "$name non esegue beforeCommit su replay idempotente",
    async ({ mutation, hasGiftLock }) => {
      const mutationInput = input(hasGiftLock ? 10_000 : 3_000);
      const { db, events } = fakeDatabase({
        kind: hasGiftLock ? "reserve" : "contribute",
        replay: true,
        mutationInput
      });
      const beforeCommit = vi.fn().mockResolvedValue(undefined);

      const result = await mutation(db, mutationInput, { beforeCommit });

      expect(result.replayed).toBe(true);
      expect(beforeCommit).not.toHaveBeenCalled();
      expect(events).toEqual(["begin", "commit"]);
    }
  );

  it.each(operations)(
    "$name propaga l'errore beforeCommit dentro la transazione",
    async ({ mutation, hasGiftLock }) => {
      const mutationInput = input(hasGiftLock ? 10_000 : 3_000);
      const { db, events } = fakeDatabase({
        kind: hasGiftLock ? "reserve" : "contribute",
        mutationInput
      });
      const failure = new Error("banking configuration invalid");

      await expect(
        mutation(db, mutationInput, {
          beforeCommit: async () => {
            events.push("before-commit");
            throw failure;
          }
        })
      ).rejects.toBe(failure);

      expect(events.at(-1)).toBe("rollback");
      expect(events).not.toContain("commit");
    }
  );
});
