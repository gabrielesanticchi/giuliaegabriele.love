import { describe, expect, it } from "vitest";

import {
  renderAdminIntentEmail,
  renderContributionEmail,
  renderReservationEmail,
  renderVerificationEmail
} from "@/lib/email/templates";

describe("transactional email templates", () => {
  it("produce sempre HTML e testo con contenuto invitato escaped", () => {
    const email = renderAdminIntentEmail({
      giftName: "Tavolo <script>alert(1)</script>",
      reference: "REQ-123",
      kind: "Prenotazione",
      method: "Bonifico",
      guestName: "Ada & Charles",
      amount: "1.200,00 €",
      createdAt: "19 agosto 2026",
      adminUrl: "https://giuliaegabriele.love/admin/requests/123"
    });

    expect(email.subject).toBe(
      "Nuova richiesta Lista Nozze — Tavolo <script>alert(1)</script>"
    );
    expect(email.html).toContain(
      "Tavolo &lt;script&gt;alert(1)&lt;/script&gt;"
    );
    expect(email.html).toContain("Ada &amp; Charles");
    expect(email.html).not.toContain("<script>");
    expect(email.text).toContain("Ada & Charles");
  });

  it("include il link personale nelle conferme senza inserire HTML non escaped", () => {
    const reservation = renderReservationEmail({
      firstName: "Ada <3",
      giftName: "Lampada",
      reference: "REQ-1",
      expiresAt: "21 agosto 2026",
      instructions: "Bonifico con causale CASA-LAMPADA-REQ1",
      personalUrl: "https://giuliaegabriele.love/richiesta/token"
    });
    const contribution = renderContributionEmail({
      firstName: "Ada <3",
      giftName: "Lampada",
      amount: "50,00 €",
      reference: "REQ-2",
      instructions: "IBAN configurato",
      personalUrl: "https://giuliaegabriele.love/richiesta/token"
    });

    expect(reservation.subject).toBe("Abbiamo riservato il tuo regalo");
    expect(contribution.subject).toBe(
      "Grazie per il tuo mattone della nostra casa"
    );
    expect(reservation.html).toContain("Ada &lt;3");
    expect(contribution.html).toContain("Ada &lt;3");
    expect(reservation.text).toContain("/richiesta/token");
    expect(contribution.text).toContain("/richiesta/token");
  });

  it("prepara la conferma di verifica in entrambe le rappresentazioni", () => {
    const email = renderVerificationEmail({
      firstName: "Ada",
      giftName: "Lampada",
      reference: "REQ-2",
      amount: "50,00 €",
      personalUrl: "https://giuliaegabriele.love/richiesta/token"
    });

    expect(email.subject).toBe("Il tuo regalo è stato verificato");
    expect(email.html).toContain("REQ-2");
    expect(email.text).toContain("50,00 €");
  });
});
