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
    phone: trimmed(30, "Inserisci un numero di telefono"),
    message: optionalTrimmed(500)
  })
  .strict();

const antiAbuseSchema = {
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

export function parseEuroAmount(value: string): number | null {
  const normalized = value.trim();
  const match = /^(0|[1-9]\d*)$/.exec(normalized);
  if (!match) return null;
  const cents = BigInt(match[1]) * 100n;
  if (cents <= 0n || cents > 100_000_000n) return null;
  return Number(cents);
}

export const euroAmountInputSchema = z
  .string()
  .trim()
  .min(1, "Inserisci un importo")
  .refine(
    (value) => parseEuroAmount(value) !== null,
    "Inserisci un importo in euro interi"
  );

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
      .multipleOf(100, "Inserisci un importo in euro interi")
      .max(100_000_000, "L’importo supera il limite")
  })
  .strict();

export const contributionGiftFormSchema = commonGiftRequestSchema
  .extend({ amount: euroAmountInputSchema })
  .strict();

export const requestActionSchema = z.object(antiAbuseSchema).strict();

export type ReserveGiftRequest = z.infer<typeof reserveGiftRequestSchema>;
export type ContributionRequest = z.infer<typeof contributionRequestSchema>;
export type RequestAction = z.infer<typeof requestActionSchema>;
