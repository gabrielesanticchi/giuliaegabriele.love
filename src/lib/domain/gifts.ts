export type PublicGiftStatus = "available" | "reserved" | "gifted";

export function getPublicGiftStatus(input: {
  completed: boolean;
  hasFullGiftLock: boolean;
}): PublicGiftStatus {
  if (input.completed) return "gifted";
  if (input.hasFullGiftLock) return "reserved";
  return "available";
}

export function getGiftFunding(input: {
  priceCents: number;
  verifiedContributionCents: number;
  pendingContributionCents: number;
}) {
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
