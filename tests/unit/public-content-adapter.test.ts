import { describe, expect, it } from "vitest";

import { mapPublicContentSnapshot } from "@/lib/public-content/adapter";

describe("database public content adapter", () => {
  const snapshot = {
    published: true,
    settings: {
      hero: { published: true, media: { kind: "art", label: "Bosco" } },
      wedding: {
        published: true,
        weddingDate: "2026-10-24T11:00:00+02:00",
        displayDate: "24 ottobre 2026",
        place: "Caleppio",
        locations: []
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
    expect(content?.gifts[0]).toMatchObject({
      status: "reserved",
      confirmedContributionCents: 2500,
      category: "Cucina"
    });
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
});
