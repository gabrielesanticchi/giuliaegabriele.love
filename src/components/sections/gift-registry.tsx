"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowUpRight, X } from "lucide-react";
import {
  type RefObject,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState
} from "react";
import { type Resolver, useForm } from "react-hook-form";

import type { PublicGift } from "@/data/demo-content";
import { formatCurrency } from "@/lib/domain/currency";
import {
  contributionRequestSchema,
  reserveGiftRequestSchema
} from "@/lib/public-api/validation";
import { TurnstileWidget } from "@/lib/turnstile/widget";

type GiftFilter = "all" | "available" | "reserved" | "gifted";
type GiftAction = "gift" | "contribute";

export interface GiftRegistryProps {
  gifts: PublicGift[];
  demoMode?: boolean;
  allowDemoSubmission?: boolean;
  privacyVersion?: string;
  turnstileSiteKey?: string;
  onDemoAction?: (gift: PublicGift, action: GiftAction) => void;
}

const filters: ReadonlyArray<{ value: GiftFilter; label: string }> = [
  { value: "all", label: "Tutti" },
  { value: "available", label: "Disponibili" },
  { value: "reserved", label: "In attesa" },
  { value: "gifted", label: "Regalati" }
];

const statusLabels = {
  available: "DISPONIBILE",
  reserved: "QUALCUNO STA GIÀ PENSANDO A QUESTO REGALO",
  gifted: "REGALATO ❤️"
} as const;

export function GiftRegistry({
  gifts,
  demoMode = false,
  allowDemoSubmission = false,
  privacyVersion = "draft-2026-08-19",
  turnstileSiteKey = "",
  onDemoAction
}: GiftRegistryProps) {
  const [filter, setFilter] = useState<GiftFilter>("all");
  const [selection, setSelection] = useState<{
    gift: PublicGift;
    action: GiftAction;
  } | null>(null);
  const invokerRef = useRef<HTMLButtonElement | null>(null);
  const visibleGifts = useMemo(
    () =>
      filter === "all" ? gifts : gifts.filter((gift) => gift.status === filter),
    [filter, gifts]
  );

  const countLabel = `${visibleGifts.length} ${
    visibleGifts.length === 1 ? "regalo mostrato" : "regali mostrati"
  }`;

  return (
    <>
      <div
        className="registry-filters"
        role="group"
        aria-label="Filtra i regali"
      >
        {filters.map((item) => (
          <button
            key={item.value}
            type="button"
            aria-pressed={filter === item.value}
            onClick={() => setFilter(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <p className="registry-count" aria-live="polite">
        {countLabel}
      </p>
      <div className="gift-grid">
        {visibleGifts.map((gift) => {
          const progress = Math.min(
            100,
            Math.round(
              (gift.confirmedContributionCents / gift.priceCents) * 100
            )
          );
          return (
            <article
              className={`gift-card${gift.featured ? " gift-card--featured" : ""}`}
              key={gift.id}
            >
              <div className="gift-art" aria-hidden="true">
                <span>{String(gifts.indexOf(gift) + 1).padStart(2, "0")}</span>
                <i />
              </div>
              <div className="gift-copy">
                <div className="gift-meta">
                  <span>{gift.room}</span>
                  <span>{gift.category}</span>
                </div>
                {gift.label ? <p className="gift-label">{gift.label}</p> : null}
                <h3>{gift.name}</h3>
                <p>{gift.description}</p>
                <p className={`gift-status gift-status--${gift.status}`}>
                  {statusLabels[gift.status]}
                </p>
                <p className="gift-price">
                  Valore indicativo {formatCurrency(gift.priceCents)}
                </p>
                {gift.allowContributions &&
                gift.confirmedContributionCents > 0 ? (
                  <div className="gift-progress">
                    <p>La nostra casa sta prendendo forma</p>
                    <div
                      className="progress-track"
                      role="progressbar"
                      aria-label={`Progresso confermato per ${gift.name}`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={progress}
                    >
                      <span style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                ) : null}
                {gift.status === "available" ? (
                  <div className="gift-actions">
                    {gift.allowFullGift ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          invokerRef.current = event.currentTarget;
                          setSelection({ gift, action: "gift" });
                        }}
                      >
                        Regala <ArrowUpRight aria-hidden="true" />
                      </button>
                    ) : null}
                    {gift.allowContributions ? (
                      <button
                        className="text-action"
                        type="button"
                        onClick={(event) => {
                          invokerRef.current = event.currentTarget;
                          setSelection({ gift, action: "contribute" });
                        }}
                      >
                        Contribuisci
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
      <GiftActionDialog
        selection={selection}
        onOpenChange={(open) => !open && setSelection(null)}
        demoMode={demoMode}
        allowDemoSubmission={allowDemoSubmission}
        privacyVersion={privacyVersion}
        turnstileSiteKey={turnstileSiteKey}
        onDemoAction={onDemoAction}
        invokerRef={invokerRef}
      />
    </>
  );
}

interface GiftActionDialogProps {
  selection: { gift: PublicGift; action: GiftAction } | null;
  onOpenChange: (open: boolean) => void;
  demoMode: boolean;
  allowDemoSubmission: boolean;
  privacyVersion: string;
  turnstileSiteKey: string;
  onDemoAction?: (gift: PublicGift, action: GiftAction) => void;
  invokerRef: RefObject<HTMLButtonElement | null>;
}

function GiftActionDialog({
  selection,
  onOpenChange,
  demoMode,
  allowDemoSubmission,
  privacyVersion,
  turnstileSiteKey,
  onDemoAction,
  invokerRef
}: GiftActionDialogProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const isContribution = selection?.action === "contribute";
  const title = isContribution
    ? "Anche un piccolo contributo può diventare un mattone della nostra casa."
    : "Vuoi regalarci questo pezzo della nostra casa?";
  const description = isContribution
    ? "Scegli l’importo che desideri. Il pagamento avverrà tramite bonifico e verrà conteggiato nella lista soltanto dopo la nostra verifica."
    : "Per evitare doppioni, terremo il regalo riservato a tuo nome per 48 ore. Il pagamento non avviene su questo sito: potrai acquistarlo dal negozio indicato oppure procedere con bonifico. Quando avremo verificato l’acquisto o il bonifico, lo segneremo come “Regalato ❤️”.";

  return (
    <Dialog.Root open={selection !== null} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          ref={contentRef}
          className="gift-dialog"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            const close = contentRef.current?.querySelector<HTMLElement>(
              "[data-dialog-close]"
            );
            close?.focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            invokerRef.current?.focus();
          }}
        >
          <Dialog.Close asChild>
            <button
              data-dialog-close
              className="dialog-close"
              type="button"
              aria-label="Chiudi"
            >
              <X aria-hidden="true" />
            </button>
          </Dialog.Close>
          <p className="eyebrow">{selection?.gift.room}</p>
          <Dialog.Title>{title}</Dialog.Title>
          <Dialog.Description>{description}</Dialog.Description>
          {!isContribution ? (
            <p className="dialog-note">
              La prenotazione non costituisce un pagamento né un ordine
              commerciale.
            </p>
          ) : null}
          {selection ? (
            <GiftIntentForm
              key={`${selection.gift.id}:${selection.action}`}
              selection={selection}
              demoMode={demoMode}
              allowDemoSubmission={allowDemoSubmission}
              privacyVersion={privacyVersion}
              turnstileSiteKey={turnstileSiteKey}
              onDemoAction={onDemoAction}
            />
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

type GiftFormValues = {
  guest: {
    firstName: string;
    lastName: string;
    email: string;
    emailConfirmation: string;
    phone?: string;
    message?: string;
  };
  privacyAccepted: boolean;
  privacyVersion: string;
  turnstileToken: string;
  honeypot: string;
  idempotencyKey: string;
  method: "external_purchase" | "bank_transfer";
  amountCents?: number;
};

type GiftSuccess = {
  ok: true;
  reference: string;
  expiresAt: string;
  personalLink: string;
  instructions: {
    type: "external_purchase" | "bank_transfer";
    accountHolder?: string;
    iban?: string;
    bankName?: string;
    transferReason?: string;
    instructions?: string;
  };
};

function GiftIntentForm({
  selection,
  demoMode,
  allowDemoSubmission,
  privacyVersion,
  turnstileSiteKey,
  onDemoAction
}: {
  selection: { gift: PublicGift; action: GiftAction };
  demoMode: boolean;
  allowDemoSubmission: boolean;
  privacyVersion: string;
  turnstileSiteKey: string;
  onDemoAction?: (gift: PublicGift, action: GiftAction) => void;
}) {
  const isContribution = selection.action === "contribute";
  const formId = useId();
  const summaryRef = useRef<HTMLDivElement>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    kind: "error" | "success";
    message: string;
    result?: GiftSuccess;
  } | null>(null);
  const resolver = zodResolver(
    isContribution ? contributionRequestSchema : reserveGiftRequestSchema
  ) as Resolver<GiftFormValues>;
  const {
    register,
    setValue,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<GiftFormValues>({
    resolver,
    shouldFocusError: false,
    shouldUnregister: true,
    defaultValues: {
      guest: {
        firstName: "",
        lastName: "",
        email: "",
        emailConfirmation: "",
        phone: "",
        message: ""
      },
      privacyAccepted: false,
      privacyVersion,
      turnstileToken:
        demoMode && allowDemoSubmission
          ? "development-demo"
          : process.env.NODE_ENV === "test" && turnstileSiteKey
            ? "turnstile-test-token"
            : "",
      honeypot: "",
      idempotencyKey: "pending-idempotency-key",
      ...(isContribution
        ? { amountCents: undefined }
        : { method: "bank_transfer" as const })
    }
  });

  useEffect(() => {
    if (feedback?.kind === "error") summaryRef.current?.focus();
  }, [feedback]);

  const submit = handleSubmit(
    async (values) => {
      setFeedback(null);
      if (
        demoMode &&
        allowDemoSubmission &&
        process.env.NODE_ENV !== "production"
      ) {
        onDemoAction?.(selection.gift, selection.action);
        setFeedback({ kind: "success", message: "Simulazione completata." });
        return;
      }

      const requestKey = idempotencyKey ?? crypto.randomUUID();
      if (!idempotencyKey) setIdempotencyKey(requestKey);
      const common = {
        guest: values.guest,
        privacyAccepted: true as const,
        privacyVersion,
        turnstileToken: values.turnstileToken,
        honeypot: values.honeypot,
        idempotencyKey: requestKey
      };
      const payload = isContribution
        ? { ...common, amountCents: values.amountCents }
        : { ...common, method: values.method };

      try {
        const response = await fetch(
          `/api/gifts/${encodeURIComponent(selection.gift.id)}/${
            isContribution ? "contribute" : "reserve"
          }`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload)
          }
        );
        const body = (await response.json()) as
          GiftSuccess | { error?: { code?: string } };
        if (!response.ok || !("ok" in body)) {
          const conflict = response.status === 409;
          setFeedback({
            kind: "error",
            message: conflict
              ? "Il regalo o l’importo non è più disponibile. Aggiorna la pagina."
              : "Non è stato possibile salvare la richiesta. Riprova."
          });
          return;
        }
        setIdempotencyKey(null);
        setFeedback({
          kind: "success",
          message: "Richiesta registrata. Conserva il link personale.",
          result: body
        });
      } catch {
        setFeedback({
          kind: "error",
          message: "Connessione non disponibile. Riprova."
        });
      }
    },
    () => {
      setFeedback({
        kind: "error",
        message: "Controlla i campi evidenziati."
      });
    }
  );

  const error = (message?: string) =>
    message ? <span className="field-error">{message}</span> : null;

  return (
    <form className="gift-intent-form" onSubmit={submit} noValidate>
      {feedback ? (
        <div
          ref={summaryRef}
          className={`form-summary form-summary--${feedback.kind}`}
          role={feedback.kind === "error" ? "alert" : "status"}
          aria-live="polite"
          tabIndex={-1}
        >
          <p>{feedback.message}</p>
          {feedback.result ? (
            <div className="one-time-instructions">
              <p>Riferimento: {feedback.result.reference}</p>
              {feedback.result.instructions.accountHolder ? (
                <p>
                  Intestatario: {feedback.result.instructions.accountHolder}
                </p>
              ) : null}
              {feedback.result.instructions.iban ? (
                <p>IBAN: {feedback.result.instructions.iban}</p>
              ) : null}
              {feedback.result.instructions.bankName ? (
                <p>Banca: {feedback.result.instructions.bankName}</p>
              ) : null}
              {feedback.result.instructions.transferReason ? (
                <p>Causale: {feedback.result.instructions.transferReason}</p>
              ) : null}
              {feedback.result.instructions.instructions ? (
                <p>{feedback.result.instructions.instructions}</p>
              ) : null}
              <a href={feedback.result.personalLink}>Gestisci la richiesta</a>
            </div>
          ) : null}
        </div>
      ) : null}
      {!feedback?.result ? (
        <>
          <div className="form-grid">
            <label htmlFor={`${formId}-first-name`}>
              Nome
              <input
                id={`${formId}-first-name`}
                autoComplete="given-name"
                aria-invalid={Boolean(errors.guest?.firstName)}
                {...register("guest.firstName")}
              />
              {error(errors.guest?.firstName?.message)}
            </label>
            <label htmlFor={`${formId}-last-name`}>
              Cognome
              <input
                id={`${formId}-last-name`}
                autoComplete="family-name"
                aria-invalid={Boolean(errors.guest?.lastName)}
                {...register("guest.lastName")}
              />
              {error(errors.guest?.lastName?.message)}
            </label>
          </div>
          <label htmlFor={`${formId}-email`}>
            Email
            <input
              id={`${formId}-email`}
              type="email"
              autoComplete="email"
              aria-invalid={Boolean(errors.guest?.email)}
              {...register("guest.email")}
            />
            {error(errors.guest?.email?.message)}
          </label>
          <label htmlFor={`${formId}-email-confirmation`}>
            Conferma email
            <input
              id={`${formId}-email-confirmation`}
              type="email"
              autoComplete="email"
              aria-invalid={Boolean(errors.guest?.emailConfirmation)}
              {...register("guest.emailConfirmation")}
            />
            {error(errors.guest?.emailConfirmation?.message)}
          </label>
          <label htmlFor={`${formId}-phone`}>
            Telefono (facoltativo)
            <input
              id={`${formId}-phone`}
              type="tel"
              autoComplete="tel"
              {...register("guest.phone")}
            />
          </label>
          <label htmlFor={`${formId}-message`}>
            Messaggio (facoltativo)
            <textarea id={`${formId}-message`} {...register("guest.message")} />
          </label>
          {isContribution ? (
            <label htmlFor={`${formId}-amount`}>
              Importo in euro
              <input
                id={`${formId}-amount`}
                type="number"
                min="1"
                step="0.01"
                inputMode="decimal"
                aria-invalid={Boolean(errors.amountCents)}
                {...register("amountCents", {
                  setValueAs: (value) => {
                    const euros = Number(value);
                    return Number.isFinite(euros)
                      ? Math.round(euros * 100)
                      : undefined;
                  }
                })}
              />
              {error(errors.amountCents?.message)}
            </label>
          ) : (
            <fieldset>
              <legend>Come desideri procedere?</legend>
              <label>
                <input
                  type="radio"
                  value="bank_transfer"
                  {...register("method")}
                />
                Bonifico
              </label>
              <label>
                <input
                  type="radio"
                  value="external_purchase"
                  {...register("method")}
                />
                Acquisto esterno
              </label>
            </fieldset>
          )}
          <label className="privacy-check">
            <input
              type="checkbox"
              aria-invalid={Boolean(errors.privacyAccepted)}
              {...register("privacyAccepted")}
            />
            Ho letto e accetto l’informativa privacy
          </label>
          {error(errors.privacyAccepted?.message)}
          <input type="hidden" {...register("turnstileToken")} />
          <input type="hidden" {...register("privacyVersion")} />
          <input type="hidden" {...register("idempotencyKey")} />
          <div className="honeypot-field" aria-hidden="true">
            <label htmlFor={`${formId}-website`}>Sito web</label>
            <input
              id={`${formId}-website`}
              tabIndex={-1}
              autoComplete="off"
              {...register("honeypot")}
            />
          </div>
          {!(demoMode && allowDemoSubmission) ? (
            <TurnstileWidget
              siteKey={turnstileSiteKey}
              onToken={(token) =>
                setValue("turnstileToken", token, { shouldValidate: true })
              }
            />
          ) : null}
          {error(errors.turnstileToken?.message)}
          <button
            className="primary-action"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Invio…" : "Continua"}
          </button>
        </>
      ) : null}
    </form>
  );
}
