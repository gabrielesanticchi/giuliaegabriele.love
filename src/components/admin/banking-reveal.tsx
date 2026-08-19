"use client";

import { useState } from "react";

type Banking = {
  accountHolder: string;
  iban: string;
  bankName?: string;
  instructions?: string;
};

export function BankingReveal() {
  const [banking, setBanking] = useState<Banking | null>(null);
  const [error, setError] = useState("");

  async function reveal() {
    setError("");
    const response = await fetch("/api/admin/banking", {
      method: "POST",
      cache: "no-store"
    });
    if (!response.ok) {
      setError("Impossibile mostrare le coordinate");
      return;
    }
    const payload = (await response.json()) as { banking: Banking | null };
    setBanking(payload.banking);
  }

  return (
    <div>
      <button type="button" onClick={reveal}>
        Mostra valori correnti
      </button>
      {banking ? (
        <dl>
          <dt>Intestatario</dt>
          <dd>{banking.accountHolder}</dd>
          <dt>IBAN</dt>
          <dd>{banking.iban}</dd>
          {banking.bankName ? (
            <>
              <dt>Banca</dt>
              <dd>{banking.bankName}</dd>
            </>
          ) : null}
        </dl>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
