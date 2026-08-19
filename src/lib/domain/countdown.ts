export type Countdown =
  | { phase: "missing" }
  | { phase: "today" }
  | { phase: "after" }
  | {
      phase: "before";
      days: number;
      hours: number;
      minutes: number;
      seconds: number;
    };

const romeDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Rome",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

function romeDateKey(date: Date): string {
  return romeDateFormatter.format(date);
}

export function getCountdown(
  weddingDate: string | null,
  now = new Date()
): Countdown {
  if (!weddingDate) return { phase: "missing" };

  const target = new Date(weddingDate);
  if (Number.isNaN(target.getTime())) return { phase: "missing" };

  const targetDay = romeDateKey(target);
  const currentDay = romeDateKey(now);

  if (targetDay === currentDay) return { phase: "today" };
  if (targetDay < currentDay) return { phase: "after" };

  const totalSeconds = Math.max(
    0,
    Math.floor((target.getTime() - now.getTime()) / 1000)
  );
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  return { phase: "before", days, hours, minutes, seconds };
}
