function referencePart(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 24);
}

export function buildTransferReason(
  giftReference: string,
  intentReference: string
): string {
  const gift = referencePart(giftReference);
  const intent = referencePart(intentReference);
  if (!gift || !intent) throw new Error("Riferimento non valido");
  return `CASA-${gift}-${intent}`;
}
