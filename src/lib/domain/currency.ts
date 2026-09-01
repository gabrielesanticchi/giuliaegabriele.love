const euroFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0
});

export function formatCurrency(euros: number): string {
  if (!Number.isSafeInteger(euros)) {
    throw new TypeError("L'importo deve essere espresso in euro interi");
  }

  return euroFormatter.format(euros);
}
