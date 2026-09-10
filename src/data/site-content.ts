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
  fit?: "cover" | "contain";
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
      title: "Tutto è iniziato tra i banchi di scuola",
      description:
        "Ci siamo conosciuti tra i banchi del liceo, quando eravamo ancora due ragazzi e il futuro sembrava tutto da scrivere. Siamo cresciuti insieme, dal diploma fino all’università, scegliendo strade diverse: Giulia nelle Professioni Sanitarie, Gabriele in Ingegneria Biomedica. Poi un master per lei, un dottorato aziendale per lui e due percorsi professionali differenti. Dieci anni di cambiamenti, traguardi e nuove sfide, affrontati continuando a scegliere, ogni giorno, di crescere insieme.",
      media: {
        url: "/story/1-banchi-di-scuola.jpeg",
        alt: "Giulia e Gabriele tra i banchi di scuola",
        focalPoint: { x: 50, y: 50 }
      }
    },
    {
      marker: "02",
      title: "Il mondo, un viaggio alla volta",
      description:
        "Viaggiare è sempre stato uno dei nostri modi preferiti di crescere insieme. Abbiamo attraversato l’Europa, dalle capitali come Parigi e Berlino ai viaggi on the road tra Andalusia, Algarve e Portogallo, fino ai paesaggi della Finlandia. Abbiamo scoperto insieme tanti angoli d’Italia, dalla Puglia alla Calabria e alla Liguria, per poi spingerci più lontano, fino al Madagascar. Ogni viaggio ci ha lasciato qualcosa, ma soprattutto ci ha insegnato che il posto più bello è quello che scopriamo insieme.",
      media: {
        url: "/story/2-viaggi-insieme.jpeg",
        alt: "Giulia e Gabriele circondati dai ricordi dei loro viaggi",
        focalPoint: { x: 50, y: 50 }
      }
    },
    {
      marker: "03",
      title: "La proposta più inaspettata",
      description:
        "Abbiamo sempre avuto passioni molto diverse: il judo per Gabriele, il mondo subacqueo per Giulia. Alle Maldive, però, questi due mondi si sono incontrati: Gabriele ha deciso di prendere il brevetto da sub per poter condividere con lei anche questa avventura. E proprio durante un’immersione, circondati dal blu dell’oceano e dalle mante, è arrivata la sorpresa più grande. Una proposta di matrimonio sott’acqua, completamente inaspettata, e un “sì” che non aveva bisogno di parole.",
      media: {
        url: "/story/3-proposta-sottacqua.jpeg",
        alt: "Gabriele propone a Giulia di sposarlo durante un’immersione",
        focalPoint: { x: 50, y: 50 },
        fit: "contain"
      }
    },
    {
      marker: "04",
      title: "Un nuovo capitolo, tutto da costruire",
      description:
        "Da poco abbiamo comprato la nostra casa, un luogo ancora tutto da immaginare, trasformare e rendere davvero nostro. Ci aspettano lavori, progetti, scelte e tanti piccoli mattoncini da mettere al loro posto, uno dopo l’altro. Dopo essere cresciuti insieme per tanti anni, oggi stiamo costruendo, anche nel vero senso della parola, il posto in cui continuerà la nostra storia.",
      media: {
        url: "/story/4-la-nostra-nuova-casa.jpeg",
        alt: "Giulia e Gabriele al lavoro nella loro nuova casa",
        focalPoint: { x: 50, y: 50 }
      }
    },
    {
      marker: "05",
      title: "Verso il nostro “Sì”",
      description:
        "E adesso ci siamo quasi. Tra preparativi, emozioni, qualche ansia e quell’impazienza che cresce ogni giorno, ci stiamo avvicinando a uno dei momenti più importanti della nostra storia. Dopo tutto quello che abbiamo vissuto e costruito insieme, siamo pronti a iniziare un nuovo capitolo. E la cosa più bella sarà farlo circondati dalle persone che amiamo, condividendo con voi il nostro “Sì” e l’inizio di tutto ciò che verrà. ❤️",
      media: {
        url: "/story/5-verso-il-matrimonio.jpeg",
        alt: "Giulia e Gabriele si preparano al matrimonio",
        focalPoint: { x: 50, y: 50 }
      }
    }
  ]
};
