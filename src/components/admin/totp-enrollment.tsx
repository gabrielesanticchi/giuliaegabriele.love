"use client";

import { useActionState, useState } from "react";

import {
  beginTotpEnrollmentAction,
  completeTotpEnrollmentAction,
  type TotpEnrollmentState
} from "@/actions/admin/totp";

const initial: TotpEnrollmentState = {
  ok: false,
  message: "Configura l'app di autenticazione per continuare."
};

export function TotpEnrollment() {
  const [setup, setSetup] = useState<TotpEnrollmentState>(initial);
  const [loading, setLoading] = useState(false);
  const [state, confirm, pending] = useActionState(
    completeTotpEnrollmentAction,
    initial
  );

  async function begin() {
    setLoading(true);
    setSetup(await beginTotpEnrollmentAction());
    setLoading(false);
  }

  return (
    <div className="totp-enrollment">
      {!setup.qrDataUrl ? (
        <button type="button" onClick={begin} disabled={loading}>
          {loading ? "Preparazione…" : "Inizia configurazione"}
        </button>
      ) : (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={setup.qrDataUrl} alt="QR per configurare TOTP" />
          <p>Salva ora questi codici: non saranno mostrati di nuovo.</p>
          <ul className="recovery-codes">
            {setup.recoveryCodes?.map((code) => (
              <li key={code}>{code}</li>
            ))}
          </ul>
          <form action={confirm}>
            <label>
              <span>Codice a 6 cifre</span>
              <input
                name="code"
                inputMode="numeric"
                pattern="[0-9]{6}"
                required
              />
            </label>
            <button type="submit" disabled={pending}>
              Attiva TOTP
            </button>
          </form>
        </>
      )}
      <p role="status">{setup.qrDataUrl ? state.message : setup.message}</p>
      {state.ok ? <a href="/admin">Continua alla dashboard</a> : null}
    </div>
  );
}
