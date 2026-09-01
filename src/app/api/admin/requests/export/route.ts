import { desc } from "drizzle-orm";

import { authorizedAdmin } from "@/actions/admin/shared";
import { getDatabase } from "@/db";
import { giftIntents } from "@/db/schema";
import { buildSafeCsv } from "@/lib/admin/csv";
import { decryptSecret } from "@/lib/security/crypto";

export const dynamic = "force-dynamic";

function guestLabel(encrypted: string): string {
  const key = process.env.DATA_ENCRYPTION_KEY?.trim();
  if (!key) return "";
  try {
    const value = JSON.parse(decryptSecret(encrypted, key)) as {
      firstName?: unknown;
      lastName?: unknown;
    };
    return [value.firstName, value.lastName]
      .filter((part): part is string => typeof part === "string")
      .join(" ");
  } catch {
    return "";
  }
}

export async function GET() {
  await authorizedAdmin("request.export");
  const rows = await getDatabase()
    .select()
    .from(giftIntents)
    .orderBy(desc(giftIntents.createdAt));
  const csv = buildSafeCsv(
    rows.map((row) => ({
      reference: row.publicReference,
      guest: guestLabel(row.guestDetailsEncrypted),
      note: row.adminNote,
      status: row.status,
      amountEuros: row.amountEuros,
      receivedAmountEuros: row.receivedAmountEuros,
      createdAt: row.createdAt.toISOString(),
      expiresAt: row.expiresAt.toISOString()
    }))
  );
  return new Response(`\uFEFF${csv}`, {
    headers: {
      "cache-control": "no-store, private",
      "content-disposition": 'attachment; filename="richieste.csv"',
      "content-type": "text/csv; charset=utf-8",
      "x-content-type-options": "nosniff"
    }
  });
}
