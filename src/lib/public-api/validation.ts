import { z } from "zod";

const trimmed = (max: number, message: string) =>
  z.string().trim().min(1, message).max(max, `Massimo ${max} caratteri`);

const optionalTrimmed = (max: number) =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().trim().max(max, `Massimo ${max} caratteri`).optional()
  );

const guestSchema = z
  .object({
    firstName: trimmed(80, "Inserisci il nome"),
    lastName: trimmed(80, "Inserisci il cognome"),
    email: z
      .string()
      .trim()
      .max(254, "Massimo 254 caratteri")
      .pipe(z.email("Inserisci un indirizzo email valido")),
    emailConfirmation: z
      .string()
      .trim()
      .max(254, "Massimo 254 caratteri")
      .pipe(z.email("Conferma l’indirizzo email")),
    phone: optionalTrimmed(30),
    message: optionalTrimmed(500)
  })
  .strict()
  .superRefine((guest, context) => {
    if (guest.email.toLowerCase() !== guest.emailConfirmation.toLowerCase()) {
      context.addIssue({
        code: "custom",
        path: ["emailConfirmation"],
        message: "Gli indirizzi email non coincidono"
      });
    }
  });

const antiAbuseSchema = {
  turnstileToken: z
    .string()
    .trim()
    .min(1, "Completa la verifica anti-spam")
    .max(2048),
  honeypot: z.string().max(200),
  idempotencyKey: z.string().trim().min(16).max(128)
};

const commonGiftRequestSchema = z.object({
  guest: guestSchema,
  privacyAccepted: z.literal(true, {
    error: "Accetta l’informativa privacy"
  }),
  privacyVersion: trimmed(50, "Versione privacy obbligatoria"),
  ...antiAbuseSchema
});

export const reserveGiftRequestSchema = commonGiftRequestSchema
  .extend({
    method: z.enum(["external_purchase", "bank_transfer"])
  })
  .strict();

export const contributionRequestSchema = commonGiftRequestSchema
  .extend({
    amountCents: z
      .number({ error: "Inserisci un importo" })
      .int("Inserisci un importo valido")
      .positive("Inserisci un importo positivo")
      .max(100_000_000, "L’importo supera il limite")
  })
  .strict();

export const requestActionSchema = z.object(antiAbuseSchema).strict();

export type ReserveGiftRequest = z.infer<typeof reserveGiftRequestSchema>;
export type ContributionRequest = z.infer<typeof contributionRequestSchema>;
export type RequestAction = z.infer<typeof requestActionSchema>;
