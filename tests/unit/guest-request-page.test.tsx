import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { GuestRequestView } from "@/app/(public)/richiesta/[token]/guest-request-view";

afterEach(cleanup);

const pending = {
  token: "a".repeat(43),
  reference: "REQ-ABC123",
  giftTitle: "Lampada per l’angolo lettura",
  kind: "contribution" as const,
  status: "pending" as const,
  amountCents: 5000,
  expiresAt: new Date("2026-08-21T12:00:00.000Z"),
  paymentDeclaredAt: null,
  turnstileSiteKey: "site-key"
};

describe("GuestRequestView", () => {
  it("mostra stato, regalo, importo e scadenza senza dati bancari o PII", () => {
    const { container } = render(<GuestRequestView request={pending} />);

    expect(
      screen.getByRole("heading", { name: "La tua richiesta" })
    ).toBeInTheDocument();
    expect(
      screen.getByText("Lampada per l’angolo lettura")
    ).toBeInTheDocument();
    expect(screen.getByText("50,00 €")).toBeInTheDocument();
    expect(screen.getByText(/REQ-ABC123/)).toBeInTheDocument();
    expect(screen.getByText(/21 agosto 2026/)).toBeInTheDocument();
    expect(container.textContent?.toLowerCase()).not.toContain("iban");
    expect(container.innerHTML).not.toContain("accountHolder");
    expect(container.innerHTML).not.toContain("email");
  });

  it("offre completamento e annullamento soltanto per una pending non dichiarata", () => {
    render(<GuestRequestView request={pending} />);

    expect(
      screen.getByRole("button", { name: "Dichiara il completamento" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Annulla la richiesta" })
    ).toBeInTheDocument();
  });

  it("nasconde l’annullamento dopo la dichiarazione di pagamento", () => {
    render(
      <GuestRequestView
        request={{
          ...pending,
          paymentDeclaredAt: new Date("2026-08-19T12:00:00.000Z")
        }}
      />
    );

    expect(screen.getByText("Completamento dichiarato")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Annulla la richiesta" })
    ).not.toBeInTheDocument();
  });

  it("non mostra azioni per uno stato terminale", () => {
    render(
      <GuestRequestView
        request={{
          ...pending,
          status: "verified",
          paymentDeclaredAt: new Date("2026-08-19T12:00:00.000Z")
        }}
      />
    );

    expect(screen.getByText("Verificato")).toBeInTheDocument();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});
