import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "../src/db/schema";
import { encryptSecret } from "../src/lib/security/crypto";

/** Seed the minimal operational data needed by the development Lista Nozze. */
const IDS = {
  category: "55555555-5555-4555-8555-555555555551",
  gift: "66666666-6666-4666-8666-666666666661"
};

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Il seed di sviluppo non può essere eseguito in produzione"
    );
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL non configurato");
  const encryptionKey = process.env.DATA_ENCRYPTION_KEY;
  if (!encryptionKey) throw new Error("DATA_ENCRYPTION_KEY non configurato");

  const client = postgres(url, { max: 1 });
  try {
    const db = drizzle(client, { schema });
    const { siteSettings, giftCategories, gifts } = schema;

    const bankingInstructions = {
      value: { configured: true },
      encryptedValue: encryptSecret(
        JSON.stringify({
          accountHolder: "Giulia e Gabriele",
          iban: "IT00X0000000000000000000000",
          bankName: "Banca dimostrativa"
        }),
        encryptionKey
      )
    };

    await db
      .insert(siteSettings)
      .values({ key: "banking_instructions", ...bankingInstructions })
      .onConflictDoUpdate({
        target: siteSettings.key,
        set: { ...bankingInstructions, updatedAt: new Date() }
      });

    await db
      .insert(giftCategories)
      .values({
        id: IDS.category,
        slug: "cucina",
        name: "Cucina",
        sortOrder: 0
      })
      .onConflictDoNothing();

    await db
      .insert(gifts)
      .values({
        id: IDS.gift,
        publicReference: "DEMO-CUCINA-01",
        categoryId: IDS.category,
        title: "Tavolo per le cene insieme",
        description: "Un luogo quotidiano per ritrovarsi e ospitare.",
        priceCents: 120_000,
        published: true,
        sortOrder: 0
      })
      .onConflictDoNothing();

    process.stdout.write("Seed Lista Nozze applicato (idempotente)\n");
  } finally {
    await client.end({ timeout: 5 });
  }
}

await main();
