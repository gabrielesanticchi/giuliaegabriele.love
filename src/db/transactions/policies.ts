import { TransactionError } from "./errors";

export type IntentRequestSemantics = {
  giftId: string;
  kind: "full_gift" | "contribution";
  method: "external_purchase" | "bank_transfer";
  amountEuros: number;
  requestFingerprintHash: string;
};

function assertEuros(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${field} deve essere un intero non negativo`);
  }
}

export function getVerificationAmounts(input: {
  priceEuros: number;
  alreadyAppliedEuros: number;
  intentAmountEuros: number;
  receivedAmountEuros: number;
}) {
  assertEuros(input.priceEuros, "priceEuros");
  assertEuros(input.alreadyAppliedEuros, "alreadyAppliedEuros");
  assertEuros(input.intentAmountEuros, "intentAmountEuros");
  assertEuros(input.receivedAmountEuros, "receivedAmountEuros");

  const remainingEuros = Math.max(
    0,
    input.priceEuros - input.alreadyAppliedEuros
  );
  const appliedAmountEuros = Math.min(
    input.receivedAmountEuros,
    input.intentAmountEuros,
    remainingEuros
  );
  return {
    receivedAmountEuros: input.receivedAmountEuros,
    appliedAmountEuros,
    completesGift:
      input.alreadyAppliedEuros + appliedAmountEuros >= input.priceEuros
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

export function assertPaymentDeclarationAllowed(input: {
  status: "pending" | "verified" | "cancelled" | "expired" | "rejected";
  paymentDeclaredAt: Date | null;
}): void {
  if (input.status !== "pending") {
    throw new TransactionError("intent_not_pending");
  }
}

export function assertGiftReservationAvailable(input: {
  now: Date;
  contributions: Array<{
    status: "pending" | "verified" | "cancelled" | "expired" | "rejected";
    expiresAt: Date;
    amountEuros: number;
    appliedAmountEuros: number;
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
    existing.amountEuros !== requested.amountEuros ||
    existing.requestFingerprintHash !== requested.requestFingerprintHash
  ) {
    throw new TransactionError("duplicate_request");
  }
}
