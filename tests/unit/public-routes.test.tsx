import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/public-content/adapter", () => ({
  loadPublicGiftsSafely: vi.fn().mockResolvedValue([])
}));

import HomePage from "@/app/(public)/page";
import ReceptionPage, {
  metadata as receptionMetadata
} from "@/app/(public)/ricevimento/page";

afterEach(cleanup);

describe("public wedding routes", () => {
  it("riserva i dettagli del ricevimento alla route dedicata", async () => {
    const home = render(await HomePage());

    expect(screen.getByText("Chiesa San Giovanni Bosco")).toBeInTheDocument();
    expect(screen.queryByText("Villa Cavenago")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Via Giuseppe Carcassola 15, Trezzo sull'Adda")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Dalle 13:00 alle 21:30")
    ).not.toBeInTheDocument();

    home.unmount();
    render(await ReceptionPage());

    expect(screen.getByText("Chiesa San Giovanni Bosco")).toBeInTheDocument();
    expect(screen.getByText("Villa Cavenago")).toBeInTheDocument();
    expect(
      screen.getByText("Via Giuseppe Carcassola 15, Trezzo sull'Adda")
    ).toBeInTheDocument();
    expect(screen.getByText("Dalle 13:00 alle 21:30")).toBeInTheDocument();
  });

  it("impedisce l'indicizzazione della route del ricevimento", () => {
    expect(receptionMetadata.robots).toEqual({ index: false, follow: false });
  });
});
