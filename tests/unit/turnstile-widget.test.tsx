import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TurnstileWidget } from "@/lib/turnstile/widget";

afterEach(cleanup);

describe("TurnstileWidget", () => {
  it("exposes a labelled group role so the aria-label is valid", () => {
    render(<TurnstileWidget siteKey="" onToken={() => {}} />);
    expect(
      screen.getByRole("group", { name: "Verifica anti-spam" })
    ).toBeInTheDocument();
  });
});
