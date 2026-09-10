import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GiftRegistry } from "@/components/sections/gift-registry";
import type { PublicGift } from "@/data/site-content";

const testGifts: PublicGift[] = [
  {
    id: "available",
    category: "Cucina",
    name: "Tavolo",
    description: "Un tavolo per stare insieme.",
    priceCents: 100000,
    productUrl: "https://example.com/tavolo",
    imagePath: "/gifts/tavolo.png",
    status: "available",
    allowFullGift: true,
    allowContributions: true,
    confirmedContributionCents: 0
  },
  {
    id: "reserved",
    category: "Soggiorno",
    name: "Libreria",
    description: "Una libreria per i nostri ricordi.",
    priceCents: 50000,
    productUrl: null,
    imagePath: null,
    status: "reserved",
    allowFullGift: true,
    allowContributions: false,
    confirmedContributionCents: 0
  },
  {
    id: "gifted",
    category: "Camera",
    name: "Tessili",
    description: "Tessili per la nostra camera.",
    priceCents: 30000,
    productUrl: null,
    imagePath: null,
    status: "gifted",
    allowFullGift: true,
    allowContributions: false,
    confirmedContributionCents: 30000
  }
];

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("GiftRegistry", () => {
  async function fillGuestForm(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText("Nome"), "Ada");
    await user.type(screen.getByLabelText("Cognome"), "Lovelace");
    await user.type(screen.getByLabelText("Telefono"), "+39 333 1234567");
    await user.click(
      screen.getByRole("checkbox", { name: /Ho letto e accetto/ })
    );
  }

  it("rende i regali nei tre stati pubblici previsti", () => {
    render(<GiftRegistry gifts={testGifts} />);

    expect(screen.getAllByRole("article")).toHaveLength(3);
    expect(screen.getByText("DISPONIBILE")).toBeInTheDocument();
    expect(
      screen.getByText("QUALCUNO STA GIÀ PENSANDO A QUESTO REGALO")
    ).toBeInTheDocument();
    expect(screen.getAllByText("REGALATO ❤️").length).toBeGreaterThanOrEqual(1);
  });

  it("mostra immagine e collegamento del prodotto", () => {
    render(<GiftRegistry gifts={[{ ...testGifts[0], priceCents: 100099 }]} />);

    expect(screen.getByText(/Prezzo di listino/)).toHaveTextContent(
      "Prezzo di listino 1.000 €"
    );
    expect(screen.getByRole("img", { name: "Tavolo" })).toHaveAttribute(
      "src",
      expect.stringContaining("%2Fgifts%2Ftavolo.png")
    );
    expect(
      screen.getByRole("link", { name: "Vedi il prodotto" })
    ).toHaveAttribute("href", "https://example.com/tavolo");
  });

  it("nasconde Regala dopo un contributo verificato e mantiene Contribuisci", () => {
    render(
      <GiftRegistry
        gifts={[
          {
            ...testGifts[0],
            allowFullGift: false,
            confirmedContributionCents: 25000
          }
        ]}
      />
    );

    expect(screen.queryByRole("button", { name: "Regala" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Contribuisci" })
    ).toBeInTheDocument();
  });

  it("filtra i regali e aggiorna il conteggio accessibile", async () => {
    const user = userEvent.setup();
    render(<GiftRegistry gifts={testGifts} />);

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
    render(<GiftRegistry gifts={testGifts} />);
    const trigger = screen.getAllByRole("button", { name: "Regala" })[0];

    await user.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("apre un dialog Regala accessibile con il copy concordato", async () => {
    const user = userEvent.setup();
    render(<GiftRegistry gifts={testGifts} />);

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
      within(dialog).getByRole("link", { name: "informativa privacy" })
    ).toHaveAttribute("href", "/privacy");
    expect(
      within(dialog).getByRole("button", { name: "Chiudi" })
    ).toHaveFocus();
  });

  it("porta il focus al riepilogo errori quando il form è incompleto", async () => {
    const user = userEvent.setup();
    render(<GiftRegistry gifts={testGifts} />);

    await user.click(screen.getAllByRole("button", { name: "Regala" })[0]);
    await user.click(screen.getByRole("button", { name: "Continua" }));

    const summary = screen.getByRole("alert");
    expect(summary).toHaveFocus();
    expect(summary).toHaveTextContent("Controlla i campi evidenziati");
    const name = screen.getByLabelText(/^Nome/);
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(name).toHaveAttribute("aria-describedby");
    expect(
      within(summary).getByRole("link", { name: "Inserisci il nome" })
    ).toHaveAttribute("href", `#${name.id}`);
    expect(summary).toHaveTextContent("Inserisci il cognome");
    expect(summary).toHaveTextContent("Inserisci un numero di telefono");
    expect(summary).toHaveTextContent("Accetta l’informativa privacy");
  });

  it("collega anche gli errori di telefono e messaggio ai relativi campi", async () => {
    const user = userEvent.setup();
    render(<GiftRegistry gifts={testGifts} />);
    await user.click(screen.getAllByRole("button", { name: "Regala" })[0]);
    const phone = screen.getByLabelText("Telefono");
    const message = screen.getByLabelText("Messaggio (facoltativo)");
    fireEvent.change(phone, { target: { value: "1".repeat(31) } });
    fireEvent.change(message, { target: { value: "x".repeat(501) } });
    await user.click(screen.getByRole("button", { name: "Continua" }));

    const summary = screen.getByRole("alert");
    expect(summary).toHaveTextContent("Massimo 30 caratteri");
    expect(summary).toHaveTextContent("Massimo 500 caratteri");
    expect(phone).toHaveAttribute("aria-invalid", "true");
    expect(phone).toHaveAttribute("aria-describedby");
    expect(message).toHaveAttribute("aria-invalid", "true");
    expect(message).toHaveAttribute("aria-describedby");
  });

  it("accetta soltanto contributi in euro interi", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          reference: "REQ-1",
          expiresAt: "2026-08-21T12:00:00.000Z",
          personalLink: "/richiesta/token",
          instructions: { type: "bank_transfer" }
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<GiftRegistry gifts={testGifts} />);
    await user.click(
      screen.getAllByRole("button", { name: "Contribuisci" })[0]
    );
    await fillGuestForm(user);
    const amount = screen.getByLabelText("Importo in euro");
    await user.type(amount, "12,34");
    await user.click(screen.getByRole("button", { name: "Continua" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Inserisci un importo in euro interi"
    );
    expect(fetchMock).not.toHaveBeenCalled();

    await user.clear(amount);
    await user.type(amount, "12");
    await user.click(screen.getByRole("button", { name: "Continua" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const sent = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as {
      amountCents: number;
      privacyVersion: string;
    };
    expect(sent.amountCents).toBe(1200);
    expect(sent.privacyVersion).toBe("2026-09-05");
  });

  it("mostra un riepilogo essenziale e consente di copiare l’IBAN", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            ok: true,
            reference: "REQ-1",
            expiresAt: "2026-08-21T12:00:00.000Z",
            personalLink: "/richiesta/token",
            instructions: {
              type: "bank_transfer",
              accountHolder: "Persona A & Persona B",
              iban: "IT00X0000000000000000000000",
              bankName: "Banca di prova",
              transferReason: "CASA-REGALO-REQ-1",
              instructions:
                'Suggeriamo di usare una causale chiara, es. "Regalo di nozze – liberalità"'
            }
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      )
    );
    render(<GiftRegistry gifts={testGifts} />);
    await user.click(screen.getAllByRole("button", { name: "Regala" })[0]);
    await fillGuestForm(user);
    await user.click(screen.getByRole("button", { name: "Continua" }));

    const summary = await screen.findByRole("status");
    expect(summary).toHaveTextContent(
      "Richiesta registrata. Conserva il link personale."
    );
    expect(summary).toHaveTextContent("Intestatario: Persona A & Persona B");
    expect(summary).toHaveTextContent("IBAN: IT00X0000000000000000000000");
    expect(summary).toHaveTextContent("Banca: Banca di prova");
    expect(summary).toHaveTextContent(/Suggeriamo di usare una causale chiara/);
    expect(summary).not.toHaveTextContent("Riferimento:");
    expect(summary).not.toHaveTextContent("CASA-REGALO-REQ-1");
    expect(
      within(summary).queryByRole("link", { name: "Gestisci la richiesta" })
    ).not.toBeInTheDocument();

    await user.click(
      within(summary).getByRole("button", { name: "Copia IBAN" })
    );
    expect(
      await within(summary).findByText("IBAN copiato")
    ).toBeInTheDocument();

    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValueOnce(
      new Error("Clipboard non disponibile")
    );
    await user.click(
      within(summary).getByRole("button", { name: "Copia IBAN" })
    );
    expect(
      await within(summary).findByText(
        "Copia non riuscita. Seleziona l’IBAN e copialo manualmente."
      )
    ).toBeInTheDocument();
  });

  it("conserva la idempotency key al retry dopo un errore", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { code: "retryable" } }), {
          status: 503,
          headers: { "content-type": "application/json" }
        })
      )
      .mockResolvedValueOnce(
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
    vi.stubGlobal("fetch", fetchMock);
    render(<GiftRegistry gifts={testGifts} />);
    await user.click(screen.getAllByRole("button", { name: "Regala" })[0]);
    await fillGuestForm(user);
    await user.click(screen.getByRole("button", { name: "Continua" }));
    await screen.findByText(
      "Non è stato possibile salvare la richiesta. Riprova."
    );

    await user.click(screen.getByRole("button", { name: "Continua" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const keys = fetchMock.mock.calls.map((call) =>
      JSON.parse(call[1]?.body as string)
    ) as Array<{ idempotencyKey: string }>;
    expect(keys[1]?.idempotencyKey).toBe(keys[0]?.idempotencyKey);
  });

  it("gestisce un replay redatto senza aspettarsi link o coordinate", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            ok: true,
            reference: "REQ-1",
            giftStatus: "reserved",
            replayed: true
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      )
    );
    render(<GiftRegistry gifts={testGifts} />);
    await user.click(screen.getAllByRole("button", { name: "Regala" })[0]);
    await fillGuestForm(user);
    await user.click(screen.getByRole("button", { name: "Continua" }));

    expect(
      await screen.findByText(/richiesta era già stata registrata/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Gestisci la richiesta" })
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/IBAN:/)).not.toBeInTheDocument();
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
    render(<GiftRegistry gifts={testGifts} />);

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
