import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from "@testing-library/react";
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

function createReducedMotionController(initial: boolean) {
  let matches = initial;
  const listeners = new Set<() => void>();
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      get matches() {
        return matches;
      },
      media: query,
      onchange: null,
      addEventListener: (_event: string, listener: () => void) =>
        listeners.add(listener),
      removeEventListener: (_event: string, listener: () => void) =>
        listeners.delete(listener),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  );

  return {
    set(next: boolean) {
      matches = next;
      listeners.forEach((listener) => listener());
    }
  };
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
          alt: "Giulia e Gabriele nel bosco",
          focalPoint: { x: 35, y: 62 }
        }}
      />
    );

    expect(
      screen.getByRole("img", { name: "Giulia e Gabriele nel bosco" })
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

    const resumeButton = await screen.findByRole("button", {
      name: "Riprendi video"
    });
    const video = document.querySelector("video");
    expect(video).toHaveProperty("muted", true);
    expect(video).toHaveAttribute("loop");
    expect(video).toHaveAttribute("playsinline");
    expect(video).toHaveAttribute("poster", "/graphics/hero-poster.jpg");

    fireEvent.play(video!);
    const pauseButton = screen.getByRole("button", { name: "Pausa video" });
    await user.click(pauseButton);
    expect(pause).toHaveBeenCalledTimes(1);
    fireEvent.pause(video!);
    expect(resumeButton).toHaveAccessibleName("Riprendi video");
    await user.click(resumeButton);
    await waitFor(() => expect(play).toHaveBeenCalledTimes(1));
    fireEvent.ended(video!);
    expect(resumeButton).toHaveAccessibleName("Riprendi video");
  });

  it("mantiene uno stato coerente quando il browser blocca play", async () => {
    setReducedMotion(false);
    const user = userEvent.setup();
    vi.spyOn(HTMLMediaElement.prototype, "play").mockRejectedValue(
      new DOMException("Autoplay blocked", "NotAllowedError")
    );

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

    const resumeButton = await screen.findByRole("button", {
      name: "Riprendi video"
    });
    await user.click(resumeButton);

    expect(resumeButton).toHaveAccessibleName("Riprendi video");
    expect(
      await screen.findByRole("status", {
        name: "Il video non può essere avviato"
      })
    ).toBeInTheDocument();
  });

  it("rimonta il video con stato pulito dopo un cambio reduced motion", async () => {
    const motion = createReducedMotionController(false);
    const user = userEvent.setup();
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

    const firstVideo = await waitFor(() => {
      const element = document.querySelector("video");
      expect(element).toBeInTheDocument();
      return element!;
    });
    fireEvent.play(firstVideo);
    expect(
      screen.getByRole("button", { name: "Pausa video" })
    ).toBeInTheDocument();
    fireEvent.error(firstVideo);
    expect(screen.getByRole("status")).toBeInTheDocument();

    act(() => motion.set(true));
    expect(
      screen.getByRole("img", { name: "Sentiero nel bosco" })
    ).toBeInTheDocument();

    act(() => motion.set(false));
    const retry = screen.getByRole("button", { name: "Riprendi video" });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(document.querySelector("video")).not.toBe(firstVideo);

    await user.click(retry);
    expect(play).toHaveBeenCalledTimes(1);
  });
});
