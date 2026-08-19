const euroFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR"
});

export function formatCurrency(cents: number): string {
  if (!Number.isSafeInteger(cents)) {
    throw new TypeError("L'importo deve essere espresso in centesimi interi");
  }

  return euroFormatter.format(cents / 100);
}
