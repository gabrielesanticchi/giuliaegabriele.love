import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PublicHome } from "@/components/sections/public-home";
import {
  demoPublicContent,
  getDemoPublicContent,
  type PublicContent
} from "@/data/demo-content";

afterEach(cleanup);

describe("PublicHome", () => {
  it("espone una struttura semantica con un solo titolo principale", () => {
    render(<PublicHome content={demoPublicContent} demoMode />);

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("navigation")).toHaveAccessibleName(
      "Navigazione principale"
    );
    expect(screen.getByRole("main")).toHaveAttribute("id", "contenuto");
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "Gabriele & Giulia" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Vai al contenuto principale" })
    ).toHaveAttribute("href", "#contenuto");
  });

  it("pubblica soltanto i dati confermati del matrimonio", () => {
    render(<PublicHome content={demoPublicContent} demoMode />);

    expect(screen.getByText("24 ottobre 2026")).toBeInTheDocument();
    expect(screen.getAllByText("Caleppio di Settala")).toHaveLength(2);
    expect(screen.getByText("Chiesa San Giovanni Bosco")).toBeInTheDocument();
    expect(
      screen.getByText("Via Giuseppe Carcassola 15, Trezzo sull'Adda")
    ).toBeInTheDocument();
    expect(screen.getByText("11:00", { selector: "time" })).toBeInTheDocument();
    expect(screen.getByText("11:00", { selector: "time" })).toHaveAttribute(
      "datetime",
      "11:00"
    );
    expect(screen.getByText("A seguire").tagName).toBe("SPAN");
    expect(screen.getByText("23:00", { selector: "time" })).toBeInTheDocument();
    expect(screen.getByText("23:00", { selector: "time" })).toHaveAttribute(
      "datetime",
      "23:00"
    );
  });

  it("nasconde Maps quando il link manca o non è HTTPS", () => {
    const content = {
      ...demoPublicContent,
      locations: demoPublicContent.locations.map((location, index) => ({
        ...location,
        mapsUrl: index === 0 ? undefined : "http://example.com/location"
      }))
    } as unknown as PublicContent;

    render(<PublicHome content={content} demoMode />);

    expect(
      screen.queryByRole("link", { name: /Apri Maps per/ })
    ).not.toBeInTheDocument();
  });

  it("mantiene generici e riconoscibili i cinque momenti demo", () => {
    render(<PublicHome content={demoPublicContent} demoMode />);

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
    expect(
      within(story).getByText("Contenuti dimostrativi")
    ).toBeInTheDocument();
  });

  it("non rende mai disponibili i contenuti demo in produzione", () => {
    expect(getDemoPublicContent("production")).toBeNull();
    expect(getDemoPublicContent("development")).toBe(demoPublicContent);
    expect(getDemoPublicContent("test")).toBe(demoPublicContent);
  });
});
