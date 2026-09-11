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
    hasLock: true
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
        imagePath: "/gifts/tavolo.png"
      })
    ]);
  });

  it("mantiene il regalo disponibile indipendentemente dai contributi storici", () => {
    const [gift] = mapPublicGifts({
      gifts: [{ ...databaseGift, hasLock: false }]
    });

    expect(gift).toMatchObject({ status: "available", allowFullGift: true });
    expect(gift).not.toHaveProperty("allowContributions");
    expect(gift).not.toHaveProperty("confirmedContributionCents");
  });

  it("restituisce una lista vuota se il database non risponde", async () => {
    const gifts = await loadPublicGiftsSafely(async () => {
      throw new Error("database unavailable");
    });

    expect(gifts).toEqual([]);
  });
});
