"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useForm } from "react-hook-form";

import { formatCurrency } from "@/lib/domain/currency";
import { TurnstileWidget } from "@/lib/turnstile/widget";

export type GuestRequestSnapshot = {
  token: string;
  reference: string;
  giftTitle: string;
  kind: "full_gift" | "contribution";
  status: "pending" | "verified" | "cancelled" | "expired" | "rejected";
  amountCents: number;
  expiresAt: Date;
  paymentDeclaredAt: Date | null;
  turnstileSiteKey: string;
};

type ActionForm = {
  turnstileToken: string;
  honeypot: string;
};

const statusLabels = {
  pending: "In attesa di verifica",
  verified: "Verificato",
  cancelled: "Annullato",
  expired: "Non più attivo",
  rejected: "Non verificato"
} as const;

export function GuestRequestView({
  request
}: {
  request: GuestRequestSnapshot;
}) {
  const [clientStatus, setClientStatus] = useState(request.status);
  const [declared, setDeclared] = useState(request.paymentDeclaredAt !== null);
  const [feedback, setFeedback] = useState("");
  const summaryRef = useRef<HTMLDivElement>(null);
  const [idempotencyKeys, setIdempotencyKeys] = useState<
    Record<"complete" | "cancel", string | null>
  >({ complete: null, cancel: null });
  const formId = useId();
  const {
    register,
    setValue,
    handleSubmit,
    formState: { isSubmitting }
  } = useForm<ActionForm>({
    defaultValues: { turnstileToken: "", honeypot: "" }
  });

  useEffect(() => {
    if (feedback) summaryRef.current?.focus();
  }, [feedback]);

  const submit = handleSubmit(async (_, event) => {
    const submitter = (event?.nativeEvent as SubmitEvent | undefined)
      ?.submitter as HTMLButtonElement | null;
    const action = submitter?.dataset.action as
      "complete" | "cancel" | undefined;
    if (!action) return;
    const turnstileToken = (
      event?.currentTarget as HTMLFormElement | undefined
    )?.elements.namedItem("turnstileToken") as HTMLInputElement | null;
    if (!turnstileToken?.value) {
      setFeedback("Completa la verifica anti-spam prima di continuare.");
      return;
    }

    const requestKey = idempotencyKeys[action] ?? crypto.randomUUID();
    if (!idempotencyKeys[action]) {
      setIdempotencyKeys((current) => ({ ...current, [action]: requestKey }));
    }
    setFeedback("");
    try {
      const response = await fetch(
        `/api/requests/${encodeURIComponent(request.token)}/${action}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            turnstileToken: turnstileToken.value,
            honeypot: "",
            idempotencyKey: requestKey
          })
        }
      );
      if (!response.ok) {
        setFeedback(
          response.status === 409
            ? "Questa operazione non è più disponibile. Aggiorna la pagina."
            : "Non è stato possibile aggiornare la richiesta. Riprova."
        );
        return;
      }
      setIdempotencyKeys((current) => ({ ...current, [action]: null }));
      if (action === "complete") {
        setDeclared(true);
        setFeedback("Completamento dichiarato. Grazie!");
      } else {
        setClientStatus("cancelled");
        setFeedback("La richiesta è stata annullata.");
      }
    } catch {
      setFeedback("Connessione non disponibile. Riprova.");
    }
  });

  const expiresAt = new Intl.DateTimeFormat("it-IT", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Rome"
  }).format(request.expiresAt);

  return (
    <main className="guest-request-page" id="contenuto">
      <section aria-labelledby={`${formId}-title`}>
        <p className="eyebrow">Lista nozze</p>
        <h1 id={`${formId}-title`}>La tua richiesta</h1>
        <dl className="guest-request-summary">
          <div>
            <dt>Stato</dt>
            <dd>
              {clientStatus === "pending" && declared
                ? "Completamento dichiarato"
                : statusLabels[clientStatus]}
            </dd>
          </div>
          <div>
            <dt>Regalo</dt>
            <dd>{request.giftTitle}</dd>
          </div>
          <div>
            <dt>Importo</dt>
            <dd>{formatCurrency(request.amountCents)}</dd>
          </div>
          <div>
            <dt>Riferimento</dt>
            <dd>{request.reference}</dd>
          </div>
          <div>
            <dt>Scadenza indicativa</dt>
            <dd>{expiresAt}</dd>
          </div>
        </dl>

        {clientStatus === "pending" ? (
          <form className="guest-request-actions" onSubmit={submit} noValidate>
            <input type="hidden" {...register("turnstileToken")} />
            <div className="honeypot-field" aria-hidden="true">
              <label htmlFor={`${formId}-website`}>Sito web</label>
              <input
                id={`${formId}-website`}
                tabIndex={-1}
                autoComplete="off"
                {...register("honeypot")}
              />
            </div>
            <TurnstileWidget
              siteKey={request.turnstileSiteKey}
              onToken={(token) =>
                setValue("turnstileToken", token, { shouldValidate: true })
              }
            />
            {feedback ? (
              <div
                ref={summaryRef}
                className="form-summary"
                role="status"
                aria-live="polite"
                tabIndex={-1}
              >
                {feedback}
              </div>
            ) : null}
            {!declared ? (
              <>
                <button
                  className="primary-action"
                  type="submit"
                  data-action="complete"
                  disabled={isSubmitting}
                >
                  Dichiara il completamento
                </button>
                <button
                  className="text-action"
                  type="submit"
                  data-action="cancel"
                  disabled={isSubmitting}
                >
                  Annulla la richiesta
                </button>
              </>
            ) : null}
          </form>
        ) : feedback ? (
          <p role="status" aria-live="polite">
            {feedback}
          </p>
        ) : null}
      </section>
    </main>
  );
}
