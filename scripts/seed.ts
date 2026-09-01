import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "../src/db/schema";
import { encryptSecret } from "../src/lib/security/crypto";

/**
 * Idempotent demo seed for development/test only. It refuses to run in
 * production so real deployments never ship demonstrative content. Fixed UUIDs
 * make re-runs a no-op. It populates enough published content for the public
 * home to render (the readiness gate requires published hero/wedding/dress,
 * required media, a reviewed privacy model and encrypted banking instructions).
 */
const IDS = {
  media: "11111111-1111-4111-8111-111111111111",
  scheduleCeremony: "22222222-2222-4222-8222-222222222221",
  scheduleReception: "22222222-2222-4222-8222-222222222222",
  scheduleFarewell: "22222222-2222-4222-8222-222222222223",
  story1: "33333333-3333-4333-8333-333333333331",
  story2: "33333333-3333-4333-8333-333333333332",
  color1: "44444444-4444-4444-8444-444444444441",
  color2: "44444444-4444-4444-8444-444444444442",
  category: "55555555-5555-4555-8555-555555555551",
  gift: "66666666-6666-4666-8666-666666666661"
};

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Il seed demo non può essere eseguito in produzione");
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL non configurato");
  const encryptionKey = process.env.DATA_ENCRYPTION_KEY;
  if (!encryptionKey) throw new Error("DATA_ENCRYPTION_KEY non configurato");

  const client = postgres(url, { max: 1 });
  try {
    const db = drizzle(client, { schema });
    const {
      siteSettings,
      mediaAssets,
      scheduleItems,
      storyMoments,
      dressCodeColors,
      giftCategories,
      gifts
    } = schema;

    await db
      .insert(mediaAssets)
      .values({
        id: IDS.media,
        pathname: "https://demo.public.blob.vercel-storage.com/storia/demo.jpg",
        contentType: "image/jpeg",
        sizeBytes: 512000,
        altText: "Fotografia dimostrativa della coppia"
      })
      .onConflictDoNothing();

    const settings: Array<{
      key: string;
      value: Record<string, unknown>;
      encryptedValue?: string;
    }> = [
      {
        key: "hero",
        value: {
          key: "hero",
          title: "Giulia & Gabriele",
          description: "Ci sposiamo il 24 ottobre 2026.",
          published: true,
          media: { kind: "art", label: "Bosco editoriale" }
        }
      },
      {
        key: "wedding",
        value: {
          key: "wedding",
          title: "Il matrimonio",
          description: "Due luoghi, un solo giorno.",
          weddingDate: "2026-10-24T11:00:00+02:00",
          displayDate: "24 ottobre 2026",
          place: "Caleppio di Settala",
          published: true,
          locations: [
            {
              kind: "ceremony",
              name: "Chiesa San Giovanni Bosco",
              address: "Caleppio di Settala",
              time: "11:00 – 12:30",
              parking: "Vi aspettiamo qualche minuto prima.",
              mapsUrl:
                "https://www.google.com/maps/search/?api=1&query=Chiesa%20San%20Giovanni%20Bosco%20Caleppio%20di%20Settala"
            },
            {
              kind: "reception",
              name: "Villa Cavenago",
              address: "Via Giuseppe Carcassola 15, Trezzo sull'Adda",
              time: "Dalle 13:00 alle 21:30",
              parking: "Parcheggio in loco.",
              mapsUrl:
                "https://www.google.com/maps/search/?api=1&query=Villa%20Cavenago%20Trezzo%20sull%27Adda"
            }
          ]
        }
      },
      {
        key: "dress_code",
        value: {
          key: "dress_code",
          title: "Vestitevi come state comodi",
          description:
            "Non c'è un vero dress code: indossate ciò che vi mette più a vostro agio.",
          note: "Se vi fa piacere, lasciatevi ispirare dai colori caldi dell'autunno.",
          published: true
        }
      },
      {
        key: "media_settings",
        value: {
          key: "media_settings",
          title: "Media",
          description: "Media richiesti per la pubblicazione.",
          requiredMediaIds: [IDS.media],
          published: true
        }
      },
      { key: "site_publication", value: { published: true } },
      { key: "admin_settings", value: { privacyReviewed: true } },
      {
        key: "banking_instructions",
        value: { configured: true },
        encryptedValue: encryptSecret(
          JSON.stringify({
            holder: "Giulia e Gabriele",
            iban: "IT00X0000000000000000000000",
            bank: "Banca dimostrativa"
          }),
          encryptionKey
        )
      }
    ];

    for (const setting of settings) {
      await db
        .insert(siteSettings)
        .values(setting)
        .onConflictDoUpdate({
          target: siteSettings.key,
          set: {
            value: setting.value,
            encryptedValue: setting.encryptedValue,
            updatedAt: new Date()
          }
        });
    }

    await db
      .insert(scheduleItems)
      .values([
        {
          id: IDS.scheduleCeremony,
          title: "Cerimonia",
          description: "Chiesa San Giovanni Bosco · fino alle 12.30",
          startsAt: new Date("2026-10-24T09:00:00Z"),
          sortOrder: 0,
          published: true
        },
        {
          id: IDS.scheduleReception,
          title: "Ricevimento",
          description: "Villa Cavenago, Trezzo sull'Adda",
          startsAt: new Date("2026-10-24T11:00:00Z"),
          sortOrder: 1,
          published: true
        },
        {
          id: IDS.scheduleFarewell,
          title: "Saluti",
          description: "La conclusione della nostra giornata insieme",
          startsAt: new Date("2026-10-24T19:30:00Z"),
          sortOrder: 2,
          published: true
        }
      ])
      .onConflictDoNothing();

    await db
      .insert(storyMoments)
      .values([
        {
          id: IDS.story1,
          title: "Il primo incontro",
          body: "Uno spazio pronto ad accogliere il nostro racconto.",
          mediaAssetId: IDS.media,
          sortOrder: 0,
          published: true
        },
        {
          id: IDS.story2,
          title: "Verso il grande giorno",
          body: "Il sentiero che ci porterà al 24 ottobre 2026.",
          sortOrder: 1,
          published: true
        }
      ])
      .onConflictDoNothing();

    await db
      .insert(dressCodeColors)
      .values([
        {
          id: IDS.color1,
          name: "Verde bosco",
          hexColor: "#20342c",
          sortOrder: 0
        },
        {
          id: IDS.color2,
          name: "Terracotta",
          hexColor: "#b6754e",
          sortOrder: 1
        }
      ])
      .onConflictDoNothing();

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
        description: "Un luogo quotidiano per ritrovarsi.",
        priceEuros: 1200,
        progressMode: "discreet",
        published: true,
        sortOrder: 0
      })
      .onConflictDoNothing();

    process.stdout.write("Seed demo applicato (idempotente)\n");
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Seed fallito"}\n`
  );
  process.exitCode = 1;
});
