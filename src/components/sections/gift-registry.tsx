"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ArrowUpRight, X } from "lucide-react";
import { type RefObject, useMemo, useRef, useState } from "react";

import type { PublicGift } from "@/data/demo-content";
import { formatCurrency } from "@/lib/domain/currency";

type GiftFilter = "all" | "available" | "reserved" | "gifted";
type GiftAction = "gift" | "contribute";

export interface GiftRegistryProps {
  gifts: PublicGift[];
  demoMode?: boolean;
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
        onContinue={() => {
          if (selection && demoMode && process.env.NODE_ENV !== "production") {
            onDemoAction?.(selection.gift, selection.action);
          }
        }}
        demoMode={demoMode}
        invokerRef={invokerRef}
      />
    </>
  );
}

interface GiftActionDialogProps {
  selection: { gift: PublicGift; action: GiftAction } | null;
  onOpenChange: (open: boolean) => void;
  onContinue: () => void;
  demoMode: boolean;
  invokerRef: RefObject<HTMLButtonElement | null>;
}

function GiftActionDialog({
  selection,
  onOpenChange,
  onContinue,
  demoMode,
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
          {demoMode && process.env.NODE_ENV !== "production" ? (
            <button
              className="primary-action"
              type="button"
              onClick={onContinue}
            >
              Continua in modalità demo
            </button>
          ) : (
            <p className="dialog-note">
              La funzione sarà disponibile alla pubblicazione della lista.
            </p>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
