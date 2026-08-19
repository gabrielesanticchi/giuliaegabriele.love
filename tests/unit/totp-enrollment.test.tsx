import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const beginTotpEnrollmentAction = vi.fn();
const restartTotpEnrollmentAction = vi.fn();
const completeTotpEnrollmentAction = vi.fn();

vi.mock("@/actions/admin/totp", () => ({
  beginTotpEnrollmentAction: () => beginTotpEnrollmentAction(),
  restartTotpEnrollmentAction: () => restartTotpEnrollmentAction(),
  completeTotpEnrollmentAction: (state: unknown, form: FormData) =>
    completeTotpEnrollmentAction(state, form)
}));

import { TotpEnrollment } from "@/components/admin/totp-enrollment";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("TotpEnrollment recovery", () => {
  it("recovers a lost enrollment through the restart control", async () => {
    const user = userEvent.setup();
    beginTotpEnrollmentAction.mockResolvedValue({
      ok: false,
      message: "Configurazione TOTP già in corso"
    });
    restartTotpEnrollmentAction.mockResolvedValue({
      ok: true,
      message: "Nuova configurazione pronta",
      qrDataUrl: "data:image/png;base64,QR",
      recoveryCodes: ["AAAAAA-BBBBBB"]
    });

    render(<TotpEnrollment />);

    await user.click(
      screen.getByRole("button", { name: "Inizia configurazione" })
    );
    await waitFor(() =>
      expect(
        screen.getByText("Configurazione TOTP già in corso")
      ).toBeInTheDocument()
    );
    expect(
      screen.queryByRole("img", { name: "QR per configurare TOTP" })
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /Ricomincia la configurazione/ })
    );
    await waitFor(() =>
      expect(
        screen.getByRole("img", { name: "QR per configurare TOTP" })
      ).toBeInTheDocument()
    );
    expect(restartTotpEnrollmentAction).toHaveBeenCalledTimes(1);
    expect(screen.getByText("AAAAAA-BBBBBB")).toBeInTheDocument();
  });
});
