import { TransactionError } from "./errors";

function assertCents(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${field} deve essere un intero non negativo`);
  }
}

export function getVerificationAmounts(input: {
  priceCents: number;
  alreadyAppliedCents: number;
  receivedAmountCents: number;
}) {
  assertCents(input.priceCents, "priceCents");
  assertCents(input.alreadyAppliedCents, "alreadyAppliedCents");
  assertCents(input.receivedAmountCents, "receivedAmountCents");

  const remainingCents = Math.max(
    0,
    input.priceCents - input.alreadyAppliedCents
  );
  const appliedAmountCents = Math.min(
    input.receivedAmountCents,
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
