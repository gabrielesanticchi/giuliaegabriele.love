const euroFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const wholeEuroFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  useGrouping: true,
  minimumFractionDigits: 0,
  maximumFractionDigits: 0
});

export function formatCurrency(cents: number): string {
  if (!Number.isSafeInteger(cents)) {
    throw new TypeError("L'importo deve essere espresso in centesimi interi");
  }

  return euroFormatter.format(cents / 100);
}

export function wholeEurosFromCents(cents: number): number {
  if (!Number.isSafeInteger(cents)) {
    throw new TypeError("L'importo deve essere espresso in centesimi interi");
  }

  return Math.floor(cents / 100);
}

export function formatWholeEuro(cents: number): string {
  return wholeEuroFormatter.format(wholeEurosFromCents(cents));
}
