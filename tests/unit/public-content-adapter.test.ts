import { describe, expect, it } from "vitest";

import {
  loadPublicGiftsSafely,
  mapPublicGifts
} from "@/lib/public-content/adapter";

describe("public gift adapter", () => {
  const databaseGift = {
    id: "g1",
    title: "Tavolo",
    description: "Casa",
    priceCents: 100000,
    productUrl: "https://example.com/tavolo",
    imagePath: "/gifts/tavolo.png",
    completed: false,
    published: true,
    archivedAt: null,
    categoryName: "Cucina",
    hasLock: true,
    verifiedCents: 25000
  };

  it("mappa soltanto i regali dinamici senza gate editoriale", () => {
    const gifts = mapPublicGifts({ gifts: [databaseGift] });

    expect(gifts).toEqual([
      expect.objectContaining({
        id: "g1",
        name: "Tavolo",
        status: "reserved",
        priceCents: 100000,
        productUrl: "https://example.com/tavolo",
        imagePath: "/gifts/tavolo.png",
        confirmedContributionCents: 25000
      })
    ]);
  });

  it.each([
    { verifiedCents: 0, expectedAllowFullGift: true },
    { verifiedCents: 1, expectedAllowFullGift: false }
  ])(
    "consente il regalo intero solo senza contributi verificati ($verifiedCents centesimi)",
    ({ verifiedCents, expectedAllowFullGift }) => {
      const [gift] = mapPublicGifts({
        gifts: [
          {
            ...databaseGift,
            hasLock: false,
            verifiedCents
          }
        ]
      });

      expect(gift).toMatchObject({
        allowFullGift: expectedAllowFullGift,
        allowContributions: true
      });
    }
  );

  it("restituisce una lista vuota se il database non risponde", async () => {
    const gifts = await loadPublicGiftsSafely(async () => {
      throw new Error("database unavailable");
    });

    expect(gifts).toEqual([]);
  });
});
