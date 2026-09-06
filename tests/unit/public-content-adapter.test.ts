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
    priceEuros: 1000,
    completed: false,
    published: true,
    archivedAt: null,
    categoryName: "Cucina",
    hasLock: true,
    verifiedEuros: 250
  };

  it("mappa soltanto i regali dinamici senza gate editoriale", () => {
    const gifts = mapPublicGifts({ gifts: [databaseGift] });

    expect(gifts).toEqual([
      expect.objectContaining({
        id: "g1",
        name: "Tavolo",
        status: "reserved",
        confirmedContributionEuros: 250
      })
    ]);
  });

  it("restituisce una lista vuota se il database non risponde", async () => {
    const gifts = await loadPublicGiftsSafely(async () => {
      throw new Error("database unavailable");
    });

    expect(gifts).toEqual([]);
  });
});
