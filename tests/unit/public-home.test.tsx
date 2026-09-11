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
    const title = screen.getByRole("heading", {
      level: 1,
      name: "Giulia & Gabriele"
    });
    expect(title).toBeInTheDocument();
    expect(title.querySelectorAll(".hero-name-line")).toHaveLength(2);
    expect(title.querySelector(".hero-and-line")).toHaveTextContent("&");
    expect(screen.getByText("Il matrimonio · 01")).toHaveClass("section-step");
    expect(screen.getByText("La nostra storia · 02")).toHaveClass(
      "section-step"
    );
    expect(screen.getByText("Lista nozze · 03")).toHaveClass("section-step");
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
      screen.getByRole("heading", { name: "Una giornata speciale" })
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
      screen.getByRole("heading", { name: "Una giornata speciale" })
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

  it("mostra i cinque capitoli finali nell'ordine corretto con le relative immagini", () => {
    render(<PublicHome content={publicContent} />);

    const story = screen.getByRole("region", {
      name: "Un sentiero da raccontare"
    });
    const expectedChapters = [
      {
        title: "Tutto è iniziato tra i banchi di scuola",
        image: "/story/1-banchi-di-scuola.jpeg",
        alt: "Giulia e Gabriele tra i banchi di scuola"
      },
      {
        title: "Il mondo, un viaggio alla volta",
        image: "/story/2-viaggi-insieme.jpeg",
        alt: "Giulia e Gabriele circondati dai ricordi dei loro viaggi"
      },
      {
        title: "La proposta più inaspettata",
        image: "/story/3-proposta-sottacqua.jpeg",
        alt: "Gabriele propone a Giulia di sposarlo durante un’immersione"
      },
      {
        title: "Un nuovo capitolo, tutto da costruire",
        image: "/story/4-la-nostra-nuova-casa.jpeg",
        alt: "Giulia e Gabriele al lavoro nella loro nuova casa"
      },
      {
        title: "Verso il nostro “Sì”",
        image: "/story/5-verso-il-matrimonio.jpeg",
        alt: "Giulia e Gabriele si preparano al matrimonio"
      }
    ];

    expect(
      within(story)
        .getAllByRole("heading", { level: 3 })
        .map((heading) => heading.textContent)
    ).toEqual(expectedChapters.map(({ title }) => title));

    expectedChapters.forEach(({ alt, image }) => {
      expect(within(story).getByRole("img", { name: alt })).toHaveAttribute(
        "src",
        image
      );
    });
    const proposalImage = within(story).getByRole("img", {
      name: "Gabriele propone a Giulia di sposarlo durante un’immersione"
    });
    expect(proposalImage).toHaveStyle({ objectFit: "contain" });
    expect(proposalImage.parentElement).toHaveClass("story-art--contain");
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
