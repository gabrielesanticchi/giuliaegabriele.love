const ROME_TIME_ZONE = "Europe/Rome";
const LOCAL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

function parts(date: Date): string {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: ROME_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}

export function formatRomeDateTimeLocal(date: Date): string {
  if (Number.isNaN(date.getTime())) throw new TypeError("Data non valida");
  return parts(date);
}

export function parseRomeDateTimeLocal(value: string): Date {
  const match = LOCAL_PATTERN.exec(value);
  if (!match) throw new TypeError("Data locale non valida");
  const [, year, month, day, hour, minute] = match;
  const wallClockUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute)
  );
  // Europe/Rome has only UTC+01/+02. Test both candidates; choosing the
  // earliest instant makes the repeated autumn hour deterministic.
  const candidates = [120, 60]
    .map((offsetMinutes) => new Date(wallClockUtc - offsetMinutes * 60_000))
    .filter((candidate) => parts(candidate) === value)
    .sort((left, right) => left.getTime() - right.getTime());
  if (!candidates[0]) throw new TypeError("Ora locale non valida");
  return candidates[0];
}

/**
 * Non-throwing variant for validation boundaries: returns `null` for malformed
 * input or a nonexistent DST wall time so callers (e.g. Zod transforms) can turn
 * the failure into a controlled issue instead of letting it escape `safeParse`.
 */
export function parseRomeDateTimeLocalSafe(value: string): Date | null {
  try {
    return parseRomeDateTimeLocal(value);
  } catch {
    return null;
  }
}
