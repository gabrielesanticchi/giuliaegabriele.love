import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PublicHome } from "@/components/sections/public-home";
import { siteContent, type PublicContent } from "@/data/site-content";

const publicContent: PublicContent = { ...siteContent, gifts: [] };

afterEach(cleanup);

describe("PublicHome", () => {
  it("espone una struttura semantica con un solo titolo principale", () => {
    render(<PublicHome content={publicContent} />);

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("navigation")).toHaveAccessibleName(
      "Navigazione principale"
    );
    expect(screen.getByRole("main")).toHaveAttribute("id", "contenuto");
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "Giulia & Gabriele" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Vai al contenuto principale" })
    ).toHaveAttribute("href", "#contenuto");
  });

  it("mostra soltanto la cerimonia nella pagina pubblica", () => {
    render(<PublicHome content={publicContent} />);

    expect(screen.getByText("24 ottobre 2026")).toBeInTheDocument();
    expect(screen.getAllByText("Caleppio di Settala")).toHaveLength(2);
    expect(screen.getByText("Chiesa San Giovanni Bosco")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Un luogo, un solo giorno" })
    ).toBeInTheDocument();
    expect(screen.queryByText("Villa Cavenago")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Via Giuseppe Carcassola 15, Trezzo sull'Adda")
    ).not.toBeInTheDocument();
    expect(screen.getByText("11:00 – 12:30")).toBeInTheDocument();
    expect(
      screen.queryByText("Dalle 13:00 alle 21:30")
    ).not.toBeInTheDocument();
  });

  it("aggiunge il ricevimento soltanto nella variante riservata", () => {
    render(<PublicHome content={publicContent} includeReception />);

    expect(
      screen.getByRole("heading", { name: "Due luoghi, un solo giorno" })
    ).toBeInTheDocument();
    expect(screen.getByText("Villa Cavenago")).toBeInTheDocument();
    expect(
      screen.getByText("Via Giuseppe Carcassola 15, Trezzo sull'Adda")
    ).toBeInTheDocument();
    expect(screen.getByText("Dalle 13:00 alle 21:30")).toBeInTheDocument();
  });

  it("nasconde Maps quando il link manca o non è HTTPS", () => {
    const content = {
      ...publicContent,
      locations: siteContent.locations.map((location, index) => ({
        ...location,
        mapsUrl: index === 0 ? undefined : "http://example.com/location"
      }))
    } as unknown as PublicContent;

    render(<PublicHome content={content} />);

    expect(
      screen.queryByRole("link", { name: /Apri Maps per/ })
    ).not.toBeInTheDocument();
  });

  it("mantiene riconoscibili i cinque momenti della storia", () => {
    render(<PublicHome content={publicContent} />);

    const story = screen.getByRole("region", {
      name: "Un sentiero da raccontare"
    });
    [
      "Il primo incontro",
      "Il primo viaggio",
      "La nostra prima casa",
      "La proposta",
      "Verso il grande giorno"
    ].forEach((title) => {
      expect(within(story).getByText(title)).toBeInTheDocument();
    });
    expect(within(story).queryByText("Contenuti dimostrativi")).toBeNull();
  });

  it("mostra la fotografia di un momento con next/image, alt e focal point", () => {
    const content: PublicContent = {
      ...publicContent,
      story: [
        {
          marker: "01",
          title: "Il primo viaggio",
          description: "Il racconto del nostro primo viaggio",
          media: {
            url: "https://store.public.blob.vercel-storage.com/storia/uno.jpg",
            alt: "Giulia e Gabriele al primo viaggio",
            focalPoint: { x: 40, y: 60 }
          }
        }
      ]
    };

    render(<PublicHome content={content} />);

    const story = screen.getByRole("region", {
      name: "Un sentiero da raccontare"
    });
    const image = within(story).getByRole("img", {
      name: "Giulia e Gabriele al primo viaggio"
    });
    expect(image).toHaveStyle({ objectPosition: "40% 60%" });
    expect(image.getAttribute("src")).toContain("storia/uno.jpg");
  });

  it("usa la line art quando un momento non ha una fotografia", () => {
    const content: PublicContent = {
      ...publicContent,
      story: [
        {
          marker: "01",
          title: "Solo testo",
          description: "Un capitolo senza immagine",
          media: null
        }
      ]
    };

    render(<PublicHome content={content} />);

    const story = screen.getByRole("region", {
      name: "Un sentiero da raccontare"
    });
    expect(
      within(story).queryByRole("img", { name: /al primo viaggio/ })
    ).not.toBeInTheDocument();
    expect(
      within(story).getByRole("img", { name: /Solo testo/ })
    ).toBeInTheDocument();
  });
});
