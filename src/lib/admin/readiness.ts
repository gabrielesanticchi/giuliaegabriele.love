import "server-only";

export type ReadinessInput = {
  heroConfigured: boolean;
  heroPublished: boolean;
  weddingConfigured: boolean;
  weddingPublished: boolean;
  schedulePublishedCount: number;
  storyPublishedCount: number;
  dressColorCount: number;
  publishedGiftCount: number;
  bankingConfigured: boolean;
  requiredMediaCount: number;
  privacyReviewed: boolean;
};

export type ReadinessItem = {
  key: string;
  label: string;
  ready: boolean;
};

export function getReadinessChecklist(input: ReadinessInput): ReadinessItem[] {
  return [
    {
      key: "hero",
      label: "Hero pubblicata",
      ready: input.heroConfigured && input.heroPublished
    },
    {
      key: "wedding",
      label: "Dettagli del matrimonio completi",
      ready: input.weddingConfigured && input.weddingPublished
    },
    {
      key: "media",
      label: "Media obbligatori verificati",
      ready: input.requiredMediaCount > 0
    },
    {
      key: "schedule",
      label: "Programma pubblicato",
      ready: input.schedulePublishedCount > 0
    },
    {
      key: "story",
      label: "Storia pubblicata",
      ready: input.storyPublishedCount > 0
    },
    {
      key: "dress-code",
      label: "Dress code configurato",
      ready: input.dressColorCount > 0
    },
    {
      key: "gifts",
      label: "Almeno un regalo pubblicato",
      ready: input.publishedGiftCount > 0
    },
    {
      key: "banking",
      label: "Coordinate bancarie configurate",
      ready: input.bankingConfigured
    },
    {
      key: "privacy",
      label: "Informativa privacy verificata",
      ready: input.privacyReviewed
    }
  ];
}

export function assertSiteReady(checklist: ReadinessItem[]): void {
  if (checklist.some((item) => !item.ready)) {
    throw new Error("Il sito non è pronto per la pubblicazione");
  }
}
