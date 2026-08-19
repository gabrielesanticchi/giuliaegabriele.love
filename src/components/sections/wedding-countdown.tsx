"use client";

import { useEffect, useState } from "react";

import { getCountdown } from "@/lib/domain/countdown";

export interface WeddingCountdownProps {
  weddingDate: string | null;
  initialNow: string;
}

export function WeddingCountdown({
  weddingDate,
  initialNow
}: WeddingCountdownProps) {
  const [now, setNow] = useState(() => new Date(initialNow));
  const countdown = getCountdown(weddingDate, now);

  useEffect(() => {
    if (!weddingDate) return;
    const timer = window.setInterval(() => setNow(new Date()), 1_000);
    return () => window.clearInterval(timer);
  }, [weddingDate]);

  if (countdown.phase === "missing") {
    return <p className="countdown-message">La data sarà annunciata presto</p>;
  }
  if (countdown.phase === "today") {
    return <p className="countdown-message">Oggi ci sposiamo</p>;
  }
  if (countdown.phase === "after") {
    return <p className="countdown-message">Il nostro viaggio è iniziato</p>;
  }

  const units = [
    [countdown.days, "Giorni"],
    [countdown.hours, "Ore"],
    [countdown.minutes, "Minuti"],
    [countdown.seconds, "Secondi"]
  ] as const;

  return (
    <div className="countdown" aria-live="off">
      <p className="countdown-kicker">Manca sempre meno</p>
      <div
        className="countdown-grid"
        aria-label="Tempo che manca al matrimonio"
      >
        {units.map(([value, label]) => (
          <span className="countdown-unit" key={label}>
            <strong>{value}</strong>
            <span>{label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
