import "server-only";

const EXPORT_COLUMNS = [
  "reference",
  "guest",
  "note",
  "status",
  "amountCents",
  "receivedAmountCents",
  "createdAt",
  "expiresAt"
] as const;

type CsvRow = Partial<Record<(typeof EXPORT_COLUMNS)[number], unknown>> &
  Record<string, unknown>;

function safeCell(value: unknown): string {
  let text = value == null ? "" : String(value);
  if (/^[\u0000-\u0020]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function buildSafeCsv(rows: CsvRow[]): string {
  const header = EXPORT_COLUMNS.map(safeCell).join(",");
  const body = rows.map((row) =>
    EXPORT_COLUMNS.map((column) => safeCell(row[column])).join(",")
  );
  return [header, ...body].join("\r\n");
}
