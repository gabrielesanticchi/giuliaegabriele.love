import { describe, expect, it } from "vitest";

import { TransactionError } from "@/db/transactions";
import { mapExhaustedSerializationFailure } from "@/db/transactions/errors";
import {
  assertCancellationAllowed,
  assertGiftReservationAvailable,
  assertIdempotentRequestMatches,
  assertPaymentDeclarationAllowed,
  getVerificationAmounts
} from "@/db/transactions/policies";

describe("gift transaction policies", () => {
  it("applies only the remaining target while retaining the received amount", () => {
    expect(
      getVerificationAmounts({
        priceCents: 10_000,
        alreadyAppliedCents: 8_000,
        intentAmountCents: 3_000,
        receivedAmountCents: 3_000
      })
    ).toEqual({
      receivedAmountCents: 3_000,
      appliedAmountCents: 2_000,
      completesGift: true
    });
  });

  it("never applies more than the amount committed by the intent", () => {
    expect(
      getVerificationAmounts({
        priceCents: 10_000,
        alreadyAppliedCents: 0,
        intentAmountCents: 6_000,
        receivedAmountCents: 10_000
      })
    ).toEqual({
      receivedAmountCents: 10_000,
      appliedAmountCents: 6_000,
      completesGift: false
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

  it("allows a repeated declaration but rejects terminal requests", () => {
    expect(() =>
      assertPaymentDeclarationAllowed({
        status: "pending",
        paymentDeclaredAt: new Date("2026-08-19T10:00:00.000Z")
      })
    ).not.toThrow();
    expect(() =>
      assertPaymentDeclarationAllowed({
        status: "cancelled",
        paymentDeclaredAt: null
      })
    ).toThrowError(
      expect.objectContaining({ code: "intent_not_pending", httpStatus: 409 })
    );
  });

  it.each([
    {
      label: "verified",
      status: "verified" as const,
      expiresAt: new Date("2026-08-19T09:00:00.000Z")
    },
    {
      label: "active pending",
      status: "pending" as const,
      expiresAt: new Date("2026-08-19T11:00:00.000Z")
    }
  ])("rejects a full gift with a $label contribution", (commitment) => {
    expect(() =>
      assertGiftReservationAvailable({
        now: new Date("2026-08-19T10:00:00.000Z"),
        contributions: [
          {
            status: commitment.status,
            expiresAt: commitment.expiresAt,
            amountCents: 1_000,
            appliedAmountCents: commitment.status === "verified" ? 1_000 : 0
          }
        ]
      })
    ).toThrowError(
      expect.objectContaining({ code: "gift_unavailable", httpStatus: 409 })
    );
  });

  it("allows a full gift when the only contribution is expired", () => {
    expect(() =>
      assertGiftReservationAvailable({
        now: new Date("2026-08-19T10:00:00.000Z"),
        contributions: [
          {
            status: "pending",
            expiresAt: new Date("2026-08-19T09:00:00.000Z"),
            amountCents: 1_000,
            appliedAmountCents: 0
          }
        ]
      })
    ).not.toThrow();
  });

  it.each([
    ["giftId", "gift-2"],
    ["kind", "contribution"],
    ["method", "external_purchase"],
    ["amountCents", 4_000],
    ["requestFingerprintHash", "b".repeat(64)]
  ] as const)(
    "rejects idempotency-key reuse when %s changes",
    (field, changedValue) => {
      const original = {
        giftId: "gift-1",
        kind: "full_gift" as const,
        method: "bank_transfer" as const,
        amountCents: 5_000,
        requestFingerprintHash: "a".repeat(64)
      };

      expect(() =>
        assertIdempotentRequestMatches(original, {
          ...original,
          [field]: changedValue
        })
      ).toThrowError(
        expect.objectContaining({ code: "duplicate_request", httpStatus: 409 })
      );
    }
  );

  it("accepts an exact retry of immutable request semantics", () => {
    const semantics = {
      giftId: "gift-1",
      kind: "contribution" as const,
      method: "bank_transfer" as const,
      amountCents: 5_000,
      requestFingerprintHash: "a".repeat(64)
    };

    expect(() =>
      assertIdempotentRequestMatches(semantics, semantics)
    ).not.toThrow();
  });

  it("maps an exhausted PostgreSQL serialization failure to retryable 409", () => {
    const postgresError = Object.assign(new Error("serialization failure"), {
      code: "40001"
    });

    const mapped = mapExhaustedSerializationFailure(postgresError);

    expect(mapped).toBeInstanceOf(TransactionError);
    expect(mapped).toMatchObject({ code: "retryable", httpStatus: 409 });
  });
});
