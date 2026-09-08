export type PublicGiftStatus = "available" | "reserved" | "gifted";

export function getPublicGiftStatus(input: {
  completed: boolean;
  hasFullGiftLock: boolean;
}): PublicGiftStatus {
  if (input.completed) return "gifted";
  if (input.hasFullGiftLock) return "reserved";
  return "available";
}

function assertValidCents(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${field} deve essere un intero non negativo sicuro`);
  }
}

export function getGiftFunding(input: {
  priceCents: number;
  verifiedContributionCents: number;
  pendingContributionCents: number;
}) {
  assertValidCents(input.priceCents, "priceCents");
  assertValidCents(
    input.verifiedContributionCents,
    "verifiedContributionCents"
  );
  assertValidCents(input.pendingContributionCents, "pendingContributionCents");

  const confirmedCents = Math.max(0, input.verifiedContributionCents);
  const pendingCents = Math.max(0, input.pendingContributionCents);
  const remainingCents = Math.max(0, input.priceCents - confirmedCents);
  const committableCents = Math.max(0, remainingCents - pendingCents);

  return {
    confirmedCents,
    pendingCents,
    remainingCents,
    committableCents,
    complete: remainingCents === 0
  };
}
