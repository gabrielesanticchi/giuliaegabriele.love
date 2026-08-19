import "server-only";

import { eq } from "drizzle-orm";

import { getDatabase } from "@/db";
import { giftIntents, gifts } from "@/db/schema";
import { hashToken } from "@/lib/security/hashing";

import type { GuestRequestSnapshot } from "./guest-request-view";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const RETENTION_MS = 30 * 24 * 60 * 60 * 1_000;

export async function loadGuestRequest(
  token: string
): Promise<GuestRequestSnapshot | null> {
  const secret = process.env.REQUEST_FINGERPRINT_SECRET?.trim();
  if (!secret || !TOKEN_PATTERN.test(token) || !process.env.DATABASE_URL) {
    return null;
  }

  try {
    const rows = await getDatabase()
      .select({
        reference: giftIntents.publicReference,
        giftTitle: gifts.title,
        kind: giftIntents.kind,
        status: giftIntents.status,
        amountCents: giftIntents.amountCents,
        expiresAt: giftIntents.expiresAt,
        paymentDeclaredAt: giftIntents.paymentDeclaredAt,
        verifiedAt: giftIntents.verifiedAt,
        cancelledAt: giftIntents.cancelledAt,
        updatedAt: giftIntents.updatedAt
      })
      .from(giftIntents)
      .innerJoin(gifts, eq(gifts.id, giftIntents.giftId))
      .where(eq(giftIntents.guestTokenHash, hashToken(token, secret)))
      .limit(1);
    const request = rows[0];
    if (!request) return null;

    if (request.status !== "pending") {
      const terminalAt =
        request.verifiedAt ?? request.cancelledAt ?? request.updatedAt;
      if (Date.now() - terminalAt.getTime() > RETENTION_MS) return null;
    }

    return {
      token,
      reference: request.reference,
      giftTitle: request.giftTitle,
      kind: request.kind,
      status: request.status,
      amountCents: request.amountCents,
      expiresAt: request.expiresAt,
      paymentDeclaredAt: request.paymentDeclaredAt,
      turnstileSiteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ""
    };
  } catch {
    return null;
  }
}
