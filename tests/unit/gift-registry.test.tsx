import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GiftRegistry } from "@/components/sections/gift-registry";
import { demoPublicContent } from "@/data/demo-content";

afterEach(cleanup);

describe("GiftRegistry", () => {
  async function fillGuestForm(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText("Nome"), "Ada");
    await user.type(screen.getByLabelText("Cognome"), "Lovelace");
    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Conferma email"), "ada@example.com");
    await user.click(
      screen.getByRole("checkbox", { name: /Ho letto e accetto/ })
    );
  }

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
    expect(
      screen.getByRole("group", { name: "Filtra i regali" })
    ).toBeInTheDocument();
  });

  it("ripristina il focus sulla CTA che ha aperto il dialog", async () => {
    const user = userEvent.setup();
    render(<GiftRegistry gifts={demoPublicContent.gifts} demoMode />);
    const trigger = screen.getAllByRole("button", { name: "Regala" })[0];

    await user.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
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

  it("apre il dialog Contribuisci e simula soltanto in demo esplicita", async () => {
    const user = userEvent.setup();
    const onDemoAction = vi.fn();
    render(
      <GiftRegistry
        gifts={demoPublicContent.gifts}
        demoMode
        allowDemoSubmission
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
    await fillGuestForm(user);
    await user.type(within(dialog).getByLabelText("Importo in euro"), "50");
    await user.click(within(dialog).getByRole("button", { name: "Continua" }));
    expect(onDemoAction).toHaveBeenCalledTimes(1);
    expect(within(dialog).getByRole("status")).toHaveTextContent(
      "Simulazione completata"
    );
  });

  it("porta il focus al riepilogo errori quando il form è incompleto", async () => {
    const user = userEvent.setup();
    render(<GiftRegistry gifts={demoPublicContent.gifts} demoMode />);

    await user.click(screen.getAllByRole("button", { name: "Regala" })[0]);
    await user.click(screen.getByRole("button", { name: "Continua" }));

    const summary = screen.getByRole("alert");
    expect(summary).toHaveFocus();
    expect(summary).toHaveTextContent("Controlla i campi evidenziati");
    expect(screen.getByLabelText(/^Nome/)).toHaveAttribute(
      "aria-invalid",
      "true"
    );
  });

  it("riusa la stessa idempotency key e blocca il doppio invio", async () => {
    const user = userEvent.setup();
    let resolveFetch: ((value: Response) => void) | undefined;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      void init;
      return new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(
      <GiftRegistry
        gifts={demoPublicContent.gifts}
        turnstileSiteKey="test-site-key"
      />
    );

    await user.click(screen.getAllByRole("button", { name: "Regala" })[0]);
    await fillGuestForm(user);
    const submit = screen.getByRole("button", { name: "Continua" });
    await user.click(submit);
    await user.click(submit);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(submit).toBeDisabled();
    const sent = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as {
      idempotencyKey: string;
    };
    expect(sent.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);

    resolveFetch?.(
      new Response(
        JSON.stringify({
          ok: true,
          reference: "REQ-1",
          expiresAt: "2026-08-21T12:00:00.000Z",
          personalLink: "/richiesta/token",
          instructions: { type: "external_purchase" }
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    vi.unstubAllGlobals();
  });
});
