"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowUpRight, X } from "lucide-react";
import Image from "next/image";
import {
  type RefObject,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState
} from "react";
import { type Resolver, useForm } from "react-hook-form";

import type { PublicGift } from "@/data/site-content";
import { formatCurrency } from "@/lib/domain/currency";
import {
  contributionGiftFormSchema,
  parseEuroAmount,
  reserveGiftRequestSchema
} from "@/lib/public-api/validation";

type GiftFilter = "all" | "available" | "reserved" | "gifted";
type GiftAction = "gift" | "contribute";

export interface GiftRegistryProps {
  gifts: PublicGift[];
  privacyVersion?: string;
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
  privacyVersion = "2026-09-05"
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
            <article className="gift-card" key={gift.id}>
              {gift.imagePath ? (
                <div className="gift-art gift-art--image">
                  <Image
                    src={gift.imagePath}
                    alt={gift.name}
                    fill
                    sizes="(max-width: 767px) 100vw, 50vw"
                  />
                </div>
              ) : (
                <div className="gift-art" aria-hidden="true">
                  <span>
                    {String(gifts.indexOf(gift) + 1).padStart(2, "0")}
                  </span>
                  <i />
                </div>
              )}
              <div className="gift-copy">
                <div className="gift-meta">
                  <span>{gift.category}</span>
                </div>
                <h3>{gift.name}</h3>
                <p>{gift.description}</p>
                <p className={`gift-status gift-status--${gift.status}`}>
                  {statusLabels[gift.status]}
                </p>
                <p className="gift-price">
                  Prezzo di listino {formatCurrency(gift.priceCents)}
                </p>
                {gift.productUrl ? (
                  <a
                    className="gift-product-link"
                    href={gift.productUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Vedi il prodotto <ArrowUpRight aria-hidden="true" />
                  </a>
                ) : null}
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
        privacyVersion={privacyVersion}
        invokerRef={invokerRef}
      />
    </>
  );
}

interface GiftActionDialogProps {
  selection: { gift: PublicGift; action: GiftAction } | null;
  onOpenChange: (open: boolean) => void;
  privacyVersion: string;
  invokerRef: RefObject<HTMLButtonElement | null>;
}

function GiftActionDialog({
  selection,
  onOpenChange,
  privacyVersion,
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
          <p className="eyebrow">{selection?.gift.category}</p>
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
              privacyVersion={privacyVersion}
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
    phone: string;
    message?: string;
  };
  privacyAccepted: boolean;
  privacyVersion: string;
  honeypot: string;
  idempotencyKey: string;
  method: "external_purchase" | "bank_transfer";
  amount?: string;
};

type GiftFirstSuccess = {
  ok: true;
  replayed?: false;
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

type GiftReplaySuccess = {
  ok: true;
  replayed: true;
  reference: string;
  giftStatus: "reserved" | "available";
};

type GiftSuccess = GiftFirstSuccess | GiftReplaySuccess;

function GiftIntentForm({
  selection,
  privacyVersion
}: {
  selection: { gift: PublicGift; action: GiftAction };
  privacyVersion: string;
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
    isContribution ? contributionGiftFormSchema : reserveGiftRequestSchema
  ) as Resolver<GiftFormValues>;
  const {
    register,
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
        phone: "",
        message: ""
      },
      privacyAccepted: false,
      privacyVersion,
      honeypot: "",
      idempotencyKey: "pending-idempotency-key",
      ...(isContribution
        ? { amount: "" }
        : { method: "bank_transfer" as const })
    }
  });

  useEffect(() => {
    if (feedback?.kind === "error") summaryRef.current?.focus();
  }, [feedback]);

  const submit = handleSubmit(
    async (values) => {
      setFeedback(null);
      const requestKey = idempotencyKey ?? crypto.randomUUID();
      if (!idempotencyKey) setIdempotencyKey(requestKey);
      const common = {
        guest: values.guest,
        privacyAccepted: true as const,
        privacyVersion,
        honeypot: values.honeypot,
        idempotencyKey: requestKey
      };
      const payload = isContribution
        ? {
            ...common,
            amountCents: parseEuroAmount(values.amount ?? "")
          }
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
          message:
            "replayed" in body && body.replayed
              ? "La richiesta era già stata registrata. Per sicurezza il link personale e le coordinate vengono mostrati una sola volta."
              : "Richiesta registrata. Conserva il link personale.",
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

  const fieldErrors = [
    {
      inputId: `${formId}-first-name`,
      errorId: `${formId}-first-name-error`,
      message: errors.guest?.firstName?.message
    },
    {
      inputId: `${formId}-last-name`,
      errorId: `${formId}-last-name-error`,
      message: errors.guest?.lastName?.message
    },
    {
      inputId: `${formId}-phone`,
      errorId: `${formId}-phone-error`,
      message: errors.guest?.phone?.message
    },
    {
      inputId: `${formId}-message`,
      errorId: `${formId}-message-error`,
      message: errors.guest?.message?.message
    },
    {
      inputId: `${formId}-amount`,
      errorId: `${formId}-amount-error`,
      message: errors.amount?.message
    },
    {
      inputId: `${formId}-method`,
      errorId: `${formId}-method-error`,
      message: errors.method?.message
    },
    {
      inputId: `${formId}-privacy`,
      errorId: `${formId}-privacy-error`,
      message: errors.privacyAccepted?.message
    }
  ].filter(
    (entry): entry is { inputId: string; errorId: string; message: string } =>
      typeof entry.message === "string"
  );

  const fieldError = (message: string | undefined, id: string) =>
    message ? (
      <span className="field-error" id={id}>
        {message}
      </span>
    ) : null;

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
          {feedback.kind === "error" && fieldErrors.length > 0 ? (
            <ul>
              {fieldErrors.map((entry) => (
                <li key={entry.inputId}>
                  <a href={`#${entry.inputId}`}>{entry.message}</a>
                </li>
              ))}
            </ul>
          ) : null}
          {feedback.result ? (
            <div className="one-time-instructions">
              <p>Riferimento: {feedback.result.reference}</p>
              {!("replayed" in feedback.result) || !feedback.result.replayed ? (
                <>
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
                    <p>
                      Causale: {feedback.result.instructions.transferReason}
                    </p>
                  ) : null}
                  {feedback.result.instructions.instructions ? (
                    <p>{feedback.result.instructions.instructions}</p>
                  ) : null}
                  <a href={feedback.result.personalLink}>
                    Gestisci la richiesta
                  </a>
                </>
              ) : null}
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
                aria-describedby={
                  errors.guest?.firstName
                    ? `${formId}-first-name-error`
                    : undefined
                }
                {...register("guest.firstName")}
              />
              {fieldError(
                errors.guest?.firstName?.message,
                `${formId}-first-name-error`
              )}
            </label>
            <label htmlFor={`${formId}-last-name`}>
              Cognome
              <input
                id={`${formId}-last-name`}
                autoComplete="family-name"
                aria-invalid={Boolean(errors.guest?.lastName)}
                aria-describedby={
                  errors.guest?.lastName
                    ? `${formId}-last-name-error`
                    : undefined
                }
                {...register("guest.lastName")}
              />
              {fieldError(
                errors.guest?.lastName?.message,
                `${formId}-last-name-error`
              )}
            </label>
          </div>
          <label htmlFor={`${formId}-phone`}>
            Telefono
            <input
              id={`${formId}-phone`}
              type="tel"
              autoComplete="tel"
              required
              aria-invalid={Boolean(errors.guest?.phone)}
              aria-describedby={
                errors.guest?.phone ? `${formId}-phone-error` : undefined
              }
              {...register("guest.phone")}
            />
            {fieldError(errors.guest?.phone?.message, `${formId}-phone-error`)}
          </label>
          <label htmlFor={`${formId}-message`}>
            Messaggio (facoltativo)
            <textarea
              id={`${formId}-message`}
              aria-invalid={Boolean(errors.guest?.message)}
              aria-describedby={
                errors.guest?.message ? `${formId}-message-error` : undefined
              }
              {...register("guest.message")}
            />
            {fieldError(
              errors.guest?.message?.message,
              `${formId}-message-error`
            )}
          </label>
          {isContribution ? (
            <label htmlFor={`${formId}-amount`}>
              Importo in euro
              <input
                id={`${formId}-amount`}
                type="text"
                inputMode="decimal"
                aria-invalid={Boolean(errors.amount)}
                aria-describedby={
                  errors.amount ? `${formId}-amount-error` : undefined
                }
                {...register("amount")}
              />
              {fieldError(errors.amount?.message, `${formId}-amount-error`)}
            </label>
          ) : (
            <fieldset
              id={`${formId}-method`}
              aria-invalid={Boolean(errors.method)}
              aria-describedby={
                errors.method ? `${formId}-method-error` : undefined
              }
            >
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
              {fieldError(errors.method?.message, `${formId}-method-error`)}
            </fieldset>
          )}
          <label className="privacy-check">
            <input
              id={`${formId}-privacy`}
              type="checkbox"
              aria-invalid={Boolean(errors.privacyAccepted)}
              aria-describedby={
                errors.privacyAccepted ? `${formId}-privacy-error` : undefined
              }
              {...register("privacyAccepted")}
            />
            <span>
              Ho letto e accetto l’
              <a href="/privacy" target="_blank" rel="noopener noreferrer">
                informativa privacy
              </a>
            </span>
          </label>
          {fieldError(
            errors.privacyAccepted?.message,
            `${formId}-privacy-error`
          )}
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
