import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { WaitingPage } from "@/components/sections/waiting-page";

afterEach(cleanup);

describe("WaitingPage", () => {
  it("mostra un'indisponibilità controllata senza contenuti demo", () => {
    render(<WaitingPage />);

    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Stiamo preparando qualcosa di speciale"
      })
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Costruiamo casa insieme")
    ).not.toBeInTheDocument();
  });
});
