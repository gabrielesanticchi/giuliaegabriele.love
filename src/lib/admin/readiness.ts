import "server-only";

export type ReadinessInput = {
  heroConfigured: boolean;
  weddingConfigured: boolean;
  schedulePublishedCount: number;
  storyPublishedCount: number;
  dressColorCount: number;
  publishedGiftCount: number;
  bankingConfigured: boolean;
  privacyReviewed: boolean;
};

export type ReadinessItem = {
  key: string;
  label: string;
  ready: boolean;
};

export function getReadinessChecklist(input: ReadinessInput): ReadinessItem[] {
  return [
    { key: "hero", label: "Hero configurata", ready: input.heroConfigured },
    {
      key: "wedding",
      label: "Dettagli del matrimonio completi",
      ready: input.weddingConfigured
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
