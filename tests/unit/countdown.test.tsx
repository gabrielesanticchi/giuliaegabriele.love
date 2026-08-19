import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { WeddingCountdown } from "@/components/sections/wedding-countdown";

afterEach(cleanup);

describe("WeddingCountdown", () => {
  it("non inventa una data quando manca", () => {
    render(
      <WeddingCountdown weddingDate={null} initialNow="2026-08-19T10:00:00Z" />
    );

    expect(
      screen.getByText("La data sarà annunciata presto")
    ).toBeInTheDocument();
    expect(screen.queryByText("Giorni")).not.toBeInTheDocument();
  });

  it("mostra il tempo residuo prima del matrimonio", () => {
    render(
      <WeddingCountdown
        weddingDate="2026-10-24T11:00:00+02:00"
        initialNow="2026-10-23T08:59:30Z"
      />
    );

    expect(screen.getByText("Manca sempre meno")).toBeInTheDocument();
    expect(screen.getByText("1", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByText("Giorni")).toBeInTheDocument();
    expect(screen.getByText("30", { selector: "strong" })).toBeInTheDocument();
  });

  it("annuncia il giorno del matrimonio", () => {
    render(
      <WeddingCountdown
        weddingDate="2026-10-24T11:00:00+02:00"
        initialNow="2026-10-24T18:00:00+02:00"
      />
    );

    expect(screen.getByText("Oggi ci sposiamo")).toBeInTheDocument();
  });

  it("mostra il messaggio conclusivo dopo il matrimonio", () => {
    render(
      <WeddingCountdown
        weddingDate="2026-10-24T11:00:00+02:00"
        initialNow="2026-10-25T00:00:00+02:00"
      />
    );

    expect(
      screen.getByText("Il nostro viaggio è iniziato")
    ).toBeInTheDocument();
  });
});
