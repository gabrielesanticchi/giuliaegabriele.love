import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HeroMedia } from "@/components/sections/hero-media";

function setReducedMotion(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("HeroMedia", () => {
  it("usa la line art originale per il contenuto demo", () => {
    render(
      <HeroMedia media={{ kind: "art", label: "Bosco e sentiero demo" }} />
    );

    expect(
      screen.getByRole("img", { name: "Bosco e sentiero demo" })
    ).toBeInTheDocument();
  });

  it("rende una fotografia con alt text e focal point", () => {
    render(
      <HeroMedia
        media={{
          kind: "image",
          src: "/graphics/hero-photo.jpg",
          alt: "Gabriele e Giulia nel bosco",
          focalPoint: { x: 35, y: 62 }
        }}
      />
    );

    expect(
      screen.getByRole("img", { name: "Gabriele e Giulia nel bosco" })
    ).toHaveStyle({ objectPosition: "35% 62%" });
  });

  it("usa il poster al posto del video con reduced motion", () => {
    setReducedMotion(true);
    render(
      <HeroMedia
        media={{
          kind: "video",
          src: "/media/hero.mp4",
          posterSrc: "/graphics/hero-poster.jpg",
          posterAlt: "Sentiero nel bosco",
          focalPoint: { x: 50, y: 40 }
        }}
      />
    );

    expect(
      screen.getByRole("img", { name: "Sentiero nel bosco" })
    ).toBeInTheDocument();
    expect(document.querySelector("video")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Pausa video" })
    ).not.toBeInTheDocument();
  });

  it("rende un video controllabile quando il movimento è consentito", async () => {
    setReducedMotion(false);
    const user = userEvent.setup();
    const pause = vi
      .spyOn(HTMLMediaElement.prototype, "pause")
      .mockImplementation(() => undefined);
    const play = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockResolvedValue(undefined);

    render(
      <HeroMedia
        media={{
          kind: "video",
          src: "/media/hero.mp4",
          posterSrc: "/graphics/hero-poster.jpg",
          posterAlt: "Sentiero nel bosco",
          focalPoint: { x: 50, y: 40 }
        }}
      />
    );

    const pauseButton = await screen.findByRole("button", {
      name: "Pausa video"
    });
    const video = document.querySelector("video");
    expect(video).toHaveProperty("muted", true);
    expect(video).toHaveAttribute("loop");
    expect(video).toHaveAttribute("playsinline");
    expect(video).toHaveAttribute("poster", "/graphics/hero-poster.jpg");

    await user.click(pauseButton);
    expect(pause).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Riprendi video" }));
    await waitFor(() => expect(play).toHaveBeenCalledTimes(1));
  });
});
