import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GiftRegistry } from "@/components/sections/gift-registry";
import { demoPublicContent } from "@/data/demo-content";

afterEach(cleanup);

describe("GiftRegistry", () => {
  it("rende otto regali e soltanto i tre stati pubblici previsti", () => {
    render(<GiftRegistry gifts={demoPublicContent.gifts} demoMode />);

    expect(screen.getAllByRole("article")).toHaveLength(8);
    expect(screen.getAllByText("DISPONIBILE").length).toBeGreaterThanOrEqual(3);
    expect(
      screen.getByText("QUALCUNO STA GIÀ PENSANDO A QUESTO REGALO")
    ).toBeInTheDocument();
    expect(screen.getAllByText("REGALATO ❤️").length).toBeGreaterThanOrEqual(1);
  });

  it("filtra i regali e aggiorna il conteggio accessibile", async () => {
    const user = userEvent.setup();
    render(<GiftRegistry gifts={demoPublicContent.gifts} demoMode />);

    await user.click(screen.getByRole("button", { name: "In attesa" }));

    expect(screen.getByText("1 regalo mostrato")).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "In attesa" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("apre un dialog Regala accessibile con il copy concordato", async () => {
    const user = userEvent.setup();
    render(<GiftRegistry gifts={demoPublicContent.gifts} demoMode />);

    await user.click(screen.getAllByRole("button", { name: "Regala" })[0]);

    const dialog = screen.getByRole("dialog", {
      name: "Vuoi regalarci questo pezzo della nostra casa?"
    });
    expect(dialog).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        /Per evitare doppioni, terremo il regalo riservato a tuo nome per 48 ore\./
      )
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        "La prenotazione non costituisce un pagamento né un ordine commerciale."
      )
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Chiudi" })
    ).toHaveFocus();
  });

  it("apre il dialog Contribuisci e abilita il placeholder soltanto in demo", async () => {
    const user = userEvent.setup();
    const onDemoAction = vi.fn();
    render(
      <GiftRegistry
        gifts={demoPublicContent.gifts}
        demoMode
        onDemoAction={onDemoAction}
      />
    );

    await user.click(
      screen.getAllByRole("button", { name: "Contribuisci" })[0]
    );
    const dialog = screen.getByRole("dialog", {
      name: "Anche un piccolo contributo può diventare un mattone della nostra casa."
    });
    expect(
      within(dialog).getByText(
        /Il pagamento avverrà tramite bonifico e verrà conteggiato nella lista soltanto dopo la nostra verifica\./
      )
    ).toBeInTheDocument();
    await user.click(
      within(dialog).getByRole("button", { name: "Continua in modalità demo" })
    );
    expect(onDemoAction).toHaveBeenCalledTimes(1);
  });
});
