export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeSubject(value: string): string {
  return value.replace(/[\r\n]+/g, " ").slice(0, 180);
}

function document(title: string, paragraphs: string[]): string {
  return `<!doctype html><html lang="it"><body><main><h1>${escapeHtml(title)}</h1>${paragraphs
    .map((paragraph) => `<p>${paragraph}</p>`)
    .join("")}</main></body></html>`;
}

export function renderAdminIntentEmail(input: {
  giftName: string;
  reference: string;
  kind: string;
  method: string;
  guestName: string;
  amount: string;
  createdAt: string;
  adminUrl: string;
}): RenderedEmail {
  const subject = safeSubject(
    `Nuova richiesta Lista Nozze — ${input.giftName}`
  );
  return {
    subject,
    html: document("Nuova richiesta Lista Nozze", [
      `Regalo: ${escapeHtml(input.giftName)}`,
      `Riferimento: ${escapeHtml(input.reference)}`,
      `Tipo: ${escapeHtml(input.kind)}`,
      `Metodo: ${escapeHtml(input.method)}`,
      `Invitato: ${escapeHtml(input.guestName)}`,
      `Importo: ${escapeHtml(input.amount)}`,
      `Data: ${escapeHtml(input.createdAt)}`,
      `<a href="${escapeHtml(input.adminUrl)}">Apri la richiesta</a>`
    ]),
    text: [
      "Nuova richiesta Lista Nozze",
      `Regalo: ${input.giftName}`,
      `Riferimento: ${input.reference}`,
      `Tipo: ${input.kind}`,
      `Metodo: ${input.method}`,
      `Invitato: ${input.guestName}`,
      `Importo: ${input.amount}`,
      `Data: ${input.createdAt}`,
      input.adminUrl
    ].join("\n")
  };
}

export function renderReservationEmail(input: {
  firstName: string;
  giftName: string;
  reference: string;
  expiresAt: string;
  instructions: string;
  personalUrl: string;
}): RenderedEmail {
  const subject = "Abbiamo riservato il tuo regalo";
  return {
    subject,
    html: document(subject, [
      `Grazie ${escapeHtml(input.firstName)}!`,
      `Abbiamo riservato ${escapeHtml(input.giftName)} fino al ${escapeHtml(input.expiresAt)}.`,
      `Riferimento: ${escapeHtml(input.reference)}`,
      escapeHtml(input.instructions),
      "Il regalo sarà segnato come verificato dopo il nostro controllo manuale.",
      `<a href="${escapeHtml(input.personalUrl)}">Gestisci la richiesta</a>`
    ]),
    text: [
      `Grazie ${input.firstName}!`,
      `Abbiamo riservato ${input.giftName} fino al ${input.expiresAt}.`,
      `Riferimento: ${input.reference}`,
      input.instructions,
      "Il regalo sarà segnato come verificato dopo il nostro controllo manuale.",
      input.personalUrl
    ].join("\n")
  };
}

export function renderContributionEmail(input: {
  firstName: string;
  giftName: string;
  amount: string;
  reference: string;
  instructions: string;
  personalUrl: string;
}): RenderedEmail {
  const subject = "Grazie per il tuo mattone della nostra casa";
  return {
    subject,
    html: document(subject, [
      `Grazie ${escapeHtml(input.firstName)}!`,
      `Il tuo contributo di ${escapeHtml(input.amount)} è destinato al ${escapeHtml(input.giftName)}.`,
      `Riferimento: ${escapeHtml(input.reference)}`,
      escapeHtml(input.instructions),
      "Il contributo sarà conteggiato dopo il nostro controllo manuale.",
      `<a href="${escapeHtml(input.personalUrl)}">Gestisci la richiesta</a>`
    ]),
    text: [
      `Grazie ${input.firstName}!`,
      `Il tuo contributo di ${input.amount} è destinato al ${input.giftName}.`,
      `Riferimento: ${input.reference}`,
      input.instructions,
      "Il contributo sarà conteggiato dopo il nostro controllo manuale.",
      input.personalUrl
    ].join("\n")
  };
}

export function renderVerificationEmail(input: {
  firstName: string;
  giftName: string;
  reference: string;
  amount: string;
  personalUrl?: string;
}): RenderedEmail {
  const subject = "Il tuo regalo è stato verificato";
  return {
    subject,
    html: document(subject, [
      `Grazie ${escapeHtml(input.firstName)}!`,
      `Abbiamo verificato ${escapeHtml(input.amount)} per ${escapeHtml(input.giftName)}.`,
      `Riferimento: ${escapeHtml(input.reference)}`,
      ...(input.personalUrl
        ? [
            `<a href="${escapeHtml(input.personalUrl)}">Consulta la richiesta</a>`
          ]
        : [])
    ]),
    text: [
      `Grazie ${input.firstName}!`,
      `Abbiamo verificato ${input.amount} per ${input.giftName}.`,
      `Riferimento: ${input.reference}`,
      ...(input.personalUrl ? [input.personalUrl] : [])
    ].join("\n")
  };
}
