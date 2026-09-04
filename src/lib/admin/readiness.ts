import "server-only";

export type ReadinessInput = {
  heroConfigured: boolean;
  heroPublished: boolean;
  weddingConfigured: boolean;
  weddingPublished: boolean;
  weddingDateConfigured: boolean;
  storyPublishedCount: number;
  publishedGiftCount: number;
  bankingConfigured: boolean;
  requiredMediaReady: boolean;
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
      ready:
        input.weddingConfigured &&
        input.weddingPublished &&
        input.weddingDateConfigured
    },
    {
      key: "media",
      label: "Media obbligatori verificati",
      ready: input.requiredMediaReady
    },
    {
      key: "story",
      label: "Storia pubblicata",
      ready: input.storyPublishedCount > 0
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
