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

export interface ScheduleItem {
  time: string;
  dateTime?: string;
  title: string;
  description: string;
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

export interface DressColor {
  name: string;
  value: string;
}

export interface PublicGift {
  id: string;
  category: string;
  room: string;
  name: string;
  description: string;
  priceCents: number;
  status: PublicGiftStatus;
  allowFullGift: boolean;
  allowContributions: boolean;
  contributionMinimumCents?: number;
  confirmedContributionCents: number;
  discreetProgress: boolean;
  featured?: boolean;
  label?: string;
  shopName?: string;
  shopUrl?: string;
}

export interface PublicContent {
  heroMedia: HeroMediaContent;
  weddingDate: string | null;
  displayDate: string | null;
  place: string;
  locations: WeddingLocation[];
  schedule: ScheduleItem[];
  story: StoryMoment[];
  dressCode: {
    name: string;
    description: string;
    note: string;
    colors: DressColor[];
  };
  gifts: PublicGift[];
}

const gift = (
  id: string,
  input: Omit<PublicGift, "id" | "confirmedContributionCents"> & {
    confirmedContributionCents?: number;
  }
): PublicGift => ({
  id,
  confirmedContributionCents: 0,
  ...input
});

export const demoPublicContent: PublicContent = {
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
  schedule: [
    {
      time: "11:00",
      dateTime: "11:00",
      title: "Cerimonia",
      description: "Chiesa San Giovanni Bosco · fino alle 12.30"
    },
    {
      time: "13:00",
      dateTime: "13:00",
      title: "Ricevimento",
      description: "Villa Cavenago, Trezzo sull'Adda"
    },
    {
      time: "21:30",
      dateTime: "21:30",
      title: "Saluti",
      description: "La conclusione della nostra giornata insieme"
    }
  ],
  story: [
    {
      marker: "01",
      title: "Il primo incontro",
      description: "Uno spazio pronto ad accogliere il nostro racconto."
    },
    {
      marker: "02",
      title: "Il primo viaggio",
      description: "Un ricordo demo, da sostituire con la nostra storia."
    },
    {
      marker: "03",
      title: "La nostra prima casa",
      description:
        "Un capitolo ancora da raccontare con parole e immagini vere."
    },
    {
      marker: "04",
      title: "La proposta",
      description: "Un momento demo, senza dettagli biografici inventati."
    },
    {
      marker: "05",
      title: "Verso il grande giorno",
      description: "Il sentiero che ci porterà al 24 ottobre 2026."
    }
  ],
  dressCode: {
    name: "Vestitevi come state comodi",
    description:
      "Non c'è un vero dress code: indossate ciò che vi mette più a vostro agio.",
    note: "Se vi fa piacere, lasciatevi ispirare dai colori caldi dell'autunno.",
    colors: [
      { name: "Verde bosco", value: "#20342c" },
      { name: "Salvia", value: "#748476" },
      { name: "Terracotta", value: "#b6754e" },
      { name: "Bordeaux", value: "#6f3237" },
      { name: "Ocra", value: "#a87932" }
    ]
  },
  gifts: [
    gift("cucina-01", {
      category: "Cucina",
      room: "Il cuore della casa",
      name: "Tavolo per le cene insieme",
      description:
        "Un luogo quotidiano per ritrovarsi, raccontarsi e ospitare.",
      priceCents: 120000,
      status: "available",
      allowFullGift: true,
      allowContributions: true,
      contributionMinimumCents: 2500,
      confirmedContributionCents: 35000,
      discreetProgress: true,
      featured: true,
      label: "Un mattone importante",
      shopName: "Negozio demo",
      shopUrl: "https://example.com"
    }),
    gift("soggiorno-02", {
      category: "Soggiorno",
      room: "Spazi da condividere",
      name: "Libreria modulare",
      description: "Una parete per libri, fotografie e piccoli ricordi.",
      priceCents: 78000,
      status: "available",
      allowFullGift: true,
      allowContributions: false,
      discreetProgress: true
    }),
    gift("camera-03", {
      category: "Camera",
      room: "La stanza quieta",
      name: "Set tessili naturali",
      description: "Tessuti morbidi e durevoli per il riposo di ogni giorno.",
      priceCents: 32000,
      status: "available",
      allowFullGift: true,
      allowContributions: false,
      discreetProgress: true
    }),
    gift("esterni-04", {
      category: "Esterni",
      room: "Fuori casa",
      name: "Piccolo giardino aromatico",
      description:
        "Vasi, erbe e attrezzi per coltivare il nostro angolo verde.",
      priceCents: 45000,
      status: "available",
      allowFullGift: true,
      allowContributions: true,
      contributionMinimumCents: 2500,
      discreetProgress: true
    }),
    gift("tecnologia-05", {
      category: "Tecnologia",
      room: "La casa che suona",
      name: "Diffusore per la musica",
      description: "La colonna sonora delle domeniche lente e delle feste.",
      priceCents: 26000,
      status: "reserved",
      allowFullGift: true,
      allowContributions: false,
      discreetProgress: true
    }),
    gift("bagno-06", {
      category: "Bagno",
      room: "Rituali quotidiani",
      name: "Specchio da parete",
      description: "Una linea semplice per dare luce alla stanza.",
      priceCents: 18000,
      status: "gifted",
      allowFullGift: true,
      allowContributions: false,
      discreetProgress: true
    }),
    gift("cucina-07", {
      category: "Cucina",
      room: "Il cuore della casa",
      name: "Servizio per gli ospiti",
      description: "Piatti e bicchieri per apparecchiare senza fretta.",
      priceCents: 24000,
      status: "gifted",
      allowFullGift: true,
      allowContributions: false,
      discreetProgress: true
    }),
    gift("progetto-08", {
      category: "Progetti speciali",
      room: "Un progetto futuro",
      name: "Angolo studio",
      description: "Una scrivania condivisa per idee, progetti e nuovi inizi.",
      priceCents: 65000,
      status: "available",
      allowFullGift: true,
      allowContributions: false,
      discreetProgress: true
    })
  ]
};

export function getDemoPublicContent(
  environment: string | undefined = process.env.NODE_ENV
): PublicContent | null {
  return environment === "development" || environment === "test"
    ? demoPublicContent
    : null;
}
