import { z } from "zod";

import { isSafeExternalUrl } from "@/lib/domain/urls";

export const emailSchema = z
  .string()
  .trim()
  .pipe(z.email("Inserisci un indirizzo email valido"));

export const optionalEmailSchema = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  emailSchema.optional()
);

export const httpsUrlSchema = z
  .string()
  .trim()
  .refine(isSafeExternalUrl, "Inserisci un URL HTTPS assoluto");

export type Email = z.infer<typeof emailSchema>;
export type OptionalEmail = z.infer<typeof optionalEmailSchema>;
export type HttpsUrl = z.infer<typeof httpsUrlSchema>;
