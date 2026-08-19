import { describe, expect, it } from "vitest";

import {
  loadPublicContentSafely,
  mapPublicContentSnapshot
} from "@/lib/public-content/adapter";

describe("database public content adapter", () => {
  const snapshot = {
    published: true,
    requiredMediaReady: true,
    operationalReady: true,
    settings: {
      hero: { published: true, media: { kind: "art", label: "Bosco" } },
      wedding: {
        published: true,
        weddingDate: "2026-10-24T11:00:00+02:00",
        displayDate: "24 ottobre 2026",
        place: "Caleppio",
        locations: [
          {
            kind: "ceremony",
            name: "Chiesa",
            address: "Via Roma 1",
            time: "11:00",
            parking: "Parcheggio sul retro",
            mapsUrl: "https://maps.example.test/chiesa"
          },
          {
            kind: "reception",
            name: "Villa",
            address: "Via Milano 2",
            time: "A seguire",
            parking: "Parcheggio interno",
            mapsUrl: "https://maps.example.test/villa"
          }
        ]
      },
      dress_code: {
        published: true,
        name: "Autunno",
        description: "Toni caldi",
        note: "Un invito"
      }
    },
    schedule: [
      {
        id: "s1",
        title: "Cerimonia",
        description: "Chiesa",
        startsAt: new Date("2026-10-24T09:00:00Z"),
        sortOrder: 0,
        published: true
      }
    ],
    story: [
      {
        id: "m1",
        title: "Inizio",
        body: "Racconto",
        sortOrder: 0,
        published: true
      }
    ],
    colors: [{ name: "Bosco", hexColor: "#20342c", sortOrder: 0 }],
    gifts: [
      {
        id: "g1",
        title: "Tavolo",
        description: "Casa",
        priceCents: 10000,
        progressMode: "discreet",
        completed: false,
        published: true,
        archivedAt: null,
        sortOrder: 0,
        categoryName: "Cucina",
        hasLock: true,
        verifiedCents: 2500,
        pendingCents: 1000
      }
    ]
  };

  it("maps only publishable database state including lock and funding", () => {
    const content = mapPublicContentSnapshot(snapshot, false);
    expect(content?.heroMedia).toEqual({ kind: "art", label: "Bosco" });
    expect(content?.schedule).toHaveLength(1);
    expect(content?.locations[0]).toMatchObject({
      kind: "ceremony",
      address: "Via Roma 1",
      note: "Parcheggio sul retro",
      mapsUrl: "https://maps.example.test/chiesa"
    });
    expect(content?.gifts[0]).toMatchObject({
      status: "reserved",
      confirmedContributionCents: 2500,
      category: "Cucina"
    });
  });

  it("includes story media url, alt and focal point in the public model", () => {
    const content = mapPublicContentSnapshot(
      {
        ...snapshot,
        story: [
          {
            ...snapshot.story[0],
            mediaUrl:
              "https://store.public.blob.vercel-storage.com/storia/uno.jpg",
            mediaAlt: "Gabriele e Giulia al primo viaggio"
          }
        ]
      },
      false
    );
    expect(content?.story[0].media).toEqual({
      url: "https://store.public.blob.vercel-storage.com/storia/uno.jpg",
      alt: "Gabriele e Giulia al primo viaggio",
      focalPoint: { x: 50, y: 50 }
    });
  });

  it("drops story media when the joined asset is archived or missing", () => {
    const content = mapPublicContentSnapshot(
      {
        ...snapshot,
        story: [{ ...snapshot.story[0], mediaUrl: null, mediaAlt: null }]
      },
      false
    );
    expect(content?.story[0].media).toBeNull();
  });

  it("drops story media with an unsafe url", () => {
    const content = mapPublicContentSnapshot(
      {
        ...snapshot,
        story: [
          {
            ...snapshot.story[0],
            mediaUrl: "javascript:alert(1)",
            mediaAlt: "Tentativo non sicuro"
          }
        ]
      },
      false
    );
    expect(content?.story[0].media).toBeNull();
  });

  it("returns waiting state when unpublished and excludes drafts publicly", () => {
    expect(
      mapPublicContentSnapshot({ ...snapshot, published: false }, false)
    ).toBeNull();
    const content = mapPublicContentSnapshot(
      {
        ...snapshot,
        schedule: [
          ...snapshot.schedule,
          { ...snapshot.schedule[0], id: "draft", published: false }
        ]
      },
      false
    );
    expect(content?.schedule).toHaveLength(1);
  });

  it("allows authenticated preview to include drafts without requiring publication", () => {
    const content = mapPublicContentSnapshot(
      {
        ...snapshot,
        published: false,
        schedule: [{ ...snapshot.schedule[0], published: false }]
      },
      true
    );
    expect(content?.schedule).toHaveLength(1);
  });

  it("turns an adapter failure into the controlled unavailable state", async () => {
    await expect(
      loadPublicContentSafely(async () => {
        throw new Error("database unavailable");
      })
    ).resolves.toBeNull();
  });
});
