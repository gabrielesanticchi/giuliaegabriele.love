import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { SiteHeader } from "@/components/layout/site-header";

afterEach(cleanup);

describe("SiteHeader", () => {
  it("apre e chiude il menu mobile ripristinando il focus", async () => {
    const user = userEvent.setup();
    render(<SiteHeader />);
    const trigger = screen.getByRole("button", { name: "Apri menu" });

    await user.click(trigger);
    expect(screen.getByRole("dialog", { name: "Menu" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Chiudi menu" })).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(
      screen.queryByRole("dialog", { name: "Menu" })
    ).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
