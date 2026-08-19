import { describe, expect, it } from "vitest";

import { TransactionError } from "@/db/transactions";
import {
  assertCancellationAllowed,
  getVerificationAmounts
} from "@/db/transactions/policies";

describe("gift transaction policies", () => {
  it("applies only the remaining target while retaining the received amount", () => {
    expect(
      getVerificationAmounts({
        priceCents: 10_000,
        alreadyAppliedCents: 8_000,
        receivedAmountCents: 3_000
      })
    ).toEqual({
      receivedAmountCents: 3_000,
      appliedAmountCents: 2_000,
      completesGift: true
    });
  });

  it("rejects guest cancellation after payment declaration", () => {
    let thrown: unknown;
    try {
      assertCancellationAllowed({
        actor: "guest",
        status: "pending",
        paymentDeclaredAt: new Date("2026-08-19T10:00:00.000Z")
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(TransactionError);
    expect(thrown).toMatchObject({
      code: "payment_already_declared",
      httpStatus: 409
    });
  });

  it("allows an administrator to cancel a declared pending intent", () => {
    expect(() =>
      assertCancellationAllowed({
        actor: "admin",
        status: "pending",
        paymentDeclaredAt: new Date("2026-08-19T10:00:00.000Z")
      })
    ).not.toThrow();
  });
});
