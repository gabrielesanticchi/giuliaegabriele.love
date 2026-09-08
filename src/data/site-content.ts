import type { PublicGiftStatus } from "@/lib/domain/gifts";

export interface WeddingLocation {
  kind: "ceremony" | "reception";
  name: string;
  place: string;
  address?: string;
  time: string;
  note: string;
  mapsUrl?: string;
}

export type HeroMediaContent =
  | { kind: "art"; label: string }
  | {
      kind: "image";
      src: string;
      alt: string;
      focalPoint: { x: number; y: number };
    }
  | {
      kind: "video";
      src: string;
      posterSrc: string;
      posterAlt: string;
      focalPoint: { x: number; y: number };
    };

export interface StoryMedia {
  url: string;
  alt: string;
  focalPoint: { x: number; y: number };
}

export interface StoryMoment {
  marker: string;
  title: string;
  description: string;
  media?: StoryMedia | null;
}

export interface PublicGift {
  id: string;
  category: string;
  name: string;
  description: string;
  productUrl: string | null;
  imagePath: string | null;
  priceCents: number;
  status: PublicGiftStatus;
  allowFullGift: boolean;
  allowContributions: boolean;
  confirmedContributionCents: number;
}

export interface PublicContent {
  heroMedia: HeroMediaContent;
  weddingDate: string | null;
  displayDate: string | null;
  place: string;
  locations: WeddingLocation[];
  story: StoryMoment[];
  gifts: PublicGift[];
}

export const siteContent: Omit<PublicContent, "gifts"> = {
  heroMedia: { kind: "art", label: "Bosco stilizzato e sentiero" },
  weddingDate: "2026-10-24T11:00:00+02:00",
  displayDate: "24 ottobre 2026",
  place: "Caleppio di Settala",
  locations: [
    {
      kind: "ceremony",
      name: "Chiesa San Giovanni Bosco",
      place: "Caleppio di Settala",
      time: "11:00 – 12:30",
      note: "Vi aspettiamo qualche minuto prima dell'inizio della cerimonia.",
      mapsUrl:
        "https://www.google.com/maps/search/?api=1&query=Chiesa%20San%20Giovanni%20Bosco%20Caleppio%20di%20Settala"
    },
    {
      kind: "reception",
      name: "Villa Cavenago",
      place: "Trezzo sull'Adda",
      address: "Via Giuseppe Carcassola 15, Trezzo sull'Adda",
      time: "Dalle 13:00 alle 21:30",
      note: "Parcheggio in loco: lungo la strada troverete il cartello con il nome della location.",
      mapsUrl:
        "https://www.google.com/maps/search/?api=1&query=Villa%20Cavenago%20Via%20Giuseppe%20Carcassola%2015%20Trezzo%20sull%27Adda"
    }
  ],
  story: [
    {
      marker: "01",
      title: "Il primo incontro",
      description: "Il capitolo da cui è iniziato il nostro cammino insieme."
    },
    {
      marker: "02",
      title: "Il primo viaggio",
      description: "Uno dei ricordi che custodiamo con più affetto."
    },
    {
      marker: "03",
      title: "La nostra prima casa",
      description: "Il luogo in cui abbiamo iniziato a costruire il futuro."
    },
    {
      marker: "04",
      title: "La proposta",
      description:
        "Il momento in cui il nostro prossimo capitolo ha preso forma."
    },
    {
      marker: "05",
      title: "Verso il grande giorno",
      description: "Il sentiero che ci porterà al 24 ottobre 2026."
    }
  ]
};
