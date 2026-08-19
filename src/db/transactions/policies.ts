import { TransactionError } from "./errors";

export type IntentRequestSemantics = {
  giftId: string;
  kind: "full_gift" | "contribution";
  method: "external_purchase" | "bank_transfer";
  amountCents: number;
  requestFingerprintHash: string;
};

function assertCents(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${field} deve essere un intero non negativo`);
  }
}

export function getVerificationAmounts(input: {
  priceCents: number;
  alreadyAppliedCents: number;
  intentAmountCents: number;
  receivedAmountCents: number;
}) {
  assertCents(input.priceCents, "priceCents");
  assertCents(input.alreadyAppliedCents, "alreadyAppliedCents");
  assertCents(input.intentAmountCents, "intentAmountCents");
  assertCents(input.receivedAmountCents, "receivedAmountCents");

  const remainingCents = Math.max(
    0,
    input.priceCents - input.alreadyAppliedCents
  );
  const appliedAmountCents = Math.min(
    input.receivedAmountCents,
    input.intentAmountCents,
    remainingCents
  );
  return {
    receivedAmountCents: input.receivedAmountCents,
    appliedAmountCents,
    completesGift:
      input.alreadyAppliedCents + appliedAmountCents >= input.priceCents
  };
}

export function assertCancellationAllowed(input: {
  actor: "guest" | "admin";
  status: "pending" | "verified" | "cancelled" | "expired" | "rejected";
  paymentDeclaredAt: Date | null;
}): void {
  if (input.status !== "pending") {
    throw new TransactionError("intent_not_pending");
  }
  if (input.actor === "guest" && input.paymentDeclaredAt) {
    throw new TransactionError("payment_already_declared");
  }
}

export function assertGiftReservationAvailable(input: {
  now: Date;
  contributions: Array<{
    status: "pending" | "verified" | "cancelled" | "expired" | "rejected";
    expiresAt: Date;
    amountCents: number;
    appliedAmountCents: number;
  }>;
}): void {
  const hasCommittedContribution = input.contributions.some(
    (contribution) =>
      contribution.status === "verified" ||
      (contribution.status === "pending" && contribution.expiresAt > input.now)
  );
  if (hasCommittedContribution) {
    throw new TransactionError("gift_unavailable");
  }
}

export function assertIdempotentRequestMatches(
  existing: IntentRequestSemantics,
  requested: IntentRequestSemantics
): void {
  if (
    existing.giftId !== requested.giftId ||
    existing.kind !== requested.kind ||
    existing.method !== requested.method ||
    existing.amountCents !== requested.amountCents ||
    existing.requestFingerprintHash !== requested.requestFingerprintHash
  ) {
    throw new TransactionError("duplicate_request");
  }
}
