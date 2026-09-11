"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowUpRight, Copy, X } from "lucide-react";
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
import { formatWholeEuro } from "@/lib/domain/currency";
import {
  contributionGiftFormSchema,
  parseEuroAmount,
  reserveGiftRequestSchema
} from "@/lib/public-api/validation";

type GiftFilter = "all" | "available" | "reserved" | "gifted";
type GiftSelection =
  { gift: PublicGift; action: "gift" } | { gift: null; action: "contribute" };

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
  const [selection, setSelection] = useState<GiftSelection | null>(null);
  const [externalGift, setExternalGift] = useState<PublicGift | null>(null);
  const invokerRef = useRef<HTMLButtonElement | null>(null);
  const visibleGifts = useMemo(
    () =>
      filter === "all" ? gifts : gifts.filter((gift) => gift.status === filter),
    [filter, gifts]
  );
  const showCommonFund = filter === "all" || filter === "available";
  const visibleGiftCount = visibleGifts.length + (showCommonFund ? 1 : 0);

  const countLabel = `${visibleGiftCount} ${
    visibleGiftCount === 1 ? "regalo mostrato" : "regali mostrati"
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
      <div className="gift-grid" role="group" aria-label="Lista dei regali">
        {visibleGifts.map((gift) => (
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
                <span>{String(gifts.indexOf(gift) + 1).padStart(2, "0")}</span>
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
              {gift.status === "available" ? (
                <div className="gift-actions">
                  {gift.productUrl ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        invokerRef.current = event.currentTarget;
                        setExternalGift(gift);
                      }}
                    >
                      Regala tramite acquisto sul sito
                      <ArrowUpRight aria-hidden="true" />
                    </button>
                  ) : null}
                  {gift.allowFullGift ? (
                    <button
                      className="text-action"
                      type="button"
                      onClick={(event) => {
                        invokerRef.current = event.currentTarget;
                        setSelection({ gift, action: "gift" });
                      }}
                    >
                      Regala tramite bonifico
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </article>
        ))}
        {showCommonFund ? (
          <article className="gift-card gift-card--fund" id="fondo-comune">
            <div className="gift-art gift-art--image">
              <Image
                src="/graphics/wedding-fund-piggy-bank.png"
                alt="Salvadanaio per il fondo comune"
                fill
                sizes="(max-width: 767px) 100vw, 50vw"
              />
            </div>
            <div className="gift-copy">
              <div className="gift-meta">
                <span>Fondo comune</span>
              </div>
              <h3>Se preferisci fare un’offerta libera</h3>
              <p>
                Un piccolo regalo, un progetto comune. Contribuisci facendoci un
                regalo per la nostra casa. Ti comunicheremo nelle prossime
                settimane a cosa avrà contribuito il regalo.
              </p>
              <p className="gift-status gift-status--available">
                {statusLabels.available}
              </p>
              <div className="gift-actions">
                <button
                  type="button"
                  onClick={(event) => {
                    invokerRef.current = event.currentTarget;
                    setSelection({ gift: null, action: "contribute" });
                  }}
                >
                  Contribuisci
                </button>
              </div>
            </div>
          </article>
        ) : null}
      </div>
      <ExternalPurchaseDialog
        gift={externalGift}
        onOpenChange={(open) => !open && setExternalGift(null)}
        invokerRef={invokerRef}
      />
      <GiftActionDialog
        selection={selection}
        onOpenChange={(open) => !open && setSelection(null)}
        privacyVersion={privacyVersion}
        invokerRef={invokerRef}
      />
    </>
  );
}

interface ExternalPurchaseDialogProps {
  gift: PublicGift | null;
  onOpenChange: (open: boolean) => void;
  invokerRef: RefObject<HTMLButtonElement | null>;
}

function ExternalPurchaseDialog({
  gift,
  onOpenChange,
  invokerRef
}: ExternalPurchaseDialogProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <Dialog.Root open={gift !== null} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          ref={contentRef}
          className="gift-dialog external-purchase-dialog"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            contentRef.current
              ?.querySelector<HTMLElement>("[data-dialog-close]")
              ?.focus();
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
          <p className="eyebrow">{gift?.category}</p>
          <Dialog.Title>Prima di acquistare il regalo</Dialog.Title>
          <Dialog.Description>
            Se decidi di acquistare davvero questo regalo, contatta Giulia o
            Gabriele tramite WhatsApp per confermarlo. In questo modo potremo
            rimuoverlo dalla Lista Nozze ed evitare acquisti doppi.
          </Dialog.Description>
          {gift?.productUrl ? (
            <Dialog.Close asChild>
              <a
                className="primary-action"
                href={gift.productUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Continua sul sito del negozio
                <ArrowUpRight aria-hidden="true" />
              </a>
            </Dialog.Close>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

interface GiftActionDialogProps {
  selection: GiftSelection | null;
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
    ? "Un contributo che rappresenta un mattone della nostra casa."
    : "Vuoi regalarci questo pezzo della nostra casa?";
  const description = isContribution
    ? "Scegli l’importo che desideri. Il pagamento avverrà tramite bonifico e verrà conteggiato nella lista soltanto dopo la nostra verifica."
    : "Per evitare doppioni, terremo il regalo riservato a tuo nome per 48 ore. Il pagamento non avviene su questo sito: riceverai le coordinate per procedere con bonifico. Quando lo avremo verificato, segneremo il regalo come “Regalato ❤️”.";

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
          <p className="eyebrow">
            {selection?.gift?.category ?? "Fondo comune Lista Nozze"}
          </p>
          <Dialog.Title>{title}</Dialog.Title>
          <Dialog.Description>{description}</Dialog.Description>
          {!isContribution && selection?.gift ? (
            <p className="gift-dialog-price">
              Prezzo di listino pieno:{" "}
              {formatWholeEuro(selection.gift.priceCents)}
            </p>
          ) : null}
          {!isContribution ? (
            <p className="dialog-note">
              La prenotazione non costituisce un pagamento né un ordine
              commerciale.
            </p>
          ) : null}
          {selection ? (
            <GiftIntentForm
              key={`${selection.gift?.id ?? "registry-fund"}:${selection.action}`}
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
  selection: GiftSelection;
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
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">(
    "idle"
  );
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
    if (feedback?.kind === "error") {
      summaryRef.current?.focus();
      return;
    }
    if (feedback?.result) {
      summaryRef.current
        ?.closest<HTMLElement>(".gift-dialog")
        ?.scrollTo?.({ top: 0 });
    }
  }, [feedback]);

  const copyIban = async (iban: string) => {
    try {
      await navigator.clipboard.writeText(iban);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("error");
    }
  };

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
        const endpoint =
          selection.action === "contribute"
            ? "/api/registry/contribute"
            : `/api/gifts/${encodeURIComponent(selection.gift.id)}/reserve`;
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload)
        });
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
  const firstResult =
    feedback?.result &&
    (!("replayed" in feedback.result) || !feedback.result.replayed)
      ? feedback.result
      : null;
  const instructions = firstResult?.instructions;
  const iban = instructions?.iban;

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
              {instructions ? (
                <>
                  {instructions.accountHolder ? (
                    <p>Intestatario: {instructions.accountHolder}</p>
                  ) : null}
                  {iban ? (
                    <div className="iban-copy-row">
                      <p>IBAN: {iban}</p>
                      <button
                        type="button"
                        className="copy-iban"
                        aria-label="Copia IBAN"
                        onClick={() => void copyIban(iban)}
                      >
                        <Copy aria-hidden="true" />
                        Copia
                      </button>
                      <span className="copy-feedback" aria-live="polite">
                        {copyStatus === "copied"
                          ? "IBAN copiato"
                          : copyStatus === "error"
                            ? "Copia non riuscita. Seleziona l’IBAN e copialo manualmente."
                            : ""}
                      </span>
                    </div>
                  ) : null}
                  {instructions.bankName ? (
                    <p>Banca: {instructions.bankName}</p>
                  ) : null}
                  {instructions.instructions ? (
                    <p className="transfer-guidance">
                      {instructions.instructions}
                    </p>
                  ) : null}
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
                inputMode="numeric"
                pattern="[0-9]*"
                aria-invalid={Boolean(errors.amount)}
                aria-describedby={
                  errors.amount ? `${formId}-amount-error` : undefined
                }
                {...register("amount")}
              />
              {fieldError(errors.amount?.message, `${formId}-amount-error`)}
            </label>
          ) : (
            <input
              type="hidden"
              value="bank_transfer"
              {...register("method")}
            />
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
