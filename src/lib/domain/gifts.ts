export type PublicGiftStatus = "available" | "reserved" | "gifted";

export function getPublicGiftStatus(input: {
  completed: boolean;
  hasFullGiftLock: boolean;
}): PublicGiftStatus {
  if (input.completed) return "gifted";
  if (input.hasFullGiftLock) return "reserved";
  return "available";
}

function assertValidEuros(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${field} deve essere un intero non negativo sicuro`);
  }
}

export function getGiftFunding(input: {
  priceEuros: number;
  verifiedContributionEuros: number;
  pendingContributionEuros: number;
}) {
  assertValidEuros(input.priceEuros, "priceEuros");
  assertValidEuros(
    input.verifiedContributionEuros,
    "verifiedContributionEuros"
  );
  assertValidEuros(input.pendingContributionEuros, "pendingContributionEuros");

  const confirmedEuros = Math.max(0, input.verifiedContributionEuros);
  const pendingEuros = Math.max(0, input.pendingContributionEuros);
  const remainingEuros = Math.max(0, input.priceEuros - confirmedEuros);
  const committableEuros = Math.max(0, remainingEuros - pendingEuros);

  return {
    confirmedEuros,
    pendingEuros,
    remainingEuros,
    committableEuros,
    complete: remainingEuros === 0
  };
}
