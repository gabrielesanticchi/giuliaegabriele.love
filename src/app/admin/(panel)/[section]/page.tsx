import { randomUUID } from "node:crypto";

import { asc, desc, isNull } from "drizzle-orm";
import { notFound } from "next/navigation";

import {
  saveDressColorAction,
  saveMediaMetadataAction,
  saveScheduleItemAction,
  saveStoryMomentAction,
  saveStructuredContentAction
} from "@/actions/admin/content";
import { saveGiftAction, saveGiftCategoryAction } from "@/actions/admin/gifts";
import {
  cancelRequestAction,
  rejectRequestAction,
  saveRequestNoteAction,
  verifyRequestAction
} from "@/actions/admin/requests";
import {
  loadReadiness,
  publishSiteAction,
  saveAdminSettingsAction,
  saveBankingAction,
  unpublishSiteAction
} from "@/actions/admin/settings";
import { StructuredEditor } from "@/components/admin/structured-editor";
import { BankingReveal } from "@/components/admin/banking-reveal";
import { getDatabase } from "@/db";
import {
  auditLogs,
  dressCodeColors,
  giftCategories,
  giftIntents,
  gifts,
  mediaAssets,
  scheduleItems,
  storyMoments
} from "@/db/schema";
import { getAdminPrincipal } from "@/lib/auth/session";
import { formatCurrency } from "@/lib/domain/currency";

export const dynamic = "force-dynamic";

const sectionTitles = {
  sito: [
    "Sito e Hero",
    "Identità, apertura e stato editoriale della homepage."
  ],
  matrimonio: ["Il matrimonio", "Data, luoghi e indicazioni pratiche."],
  programma: ["Programma", "Orari e momenti della giornata."],
  storia: [
    "La nostra storia",
    "Una sequenza editoriale di momenti e immagini."
  ],
  "dress-code": ["Dress code", "Palette e invito gentile agli ospiti."],
  regali: ["Lista nozze", "Categorie, regali e stato di pubblicazione."],
  richieste: ["Richieste", "Verifiche manuali e stato dei contributi."],
  media: ["Media", "Metadati e testi alternativi degli asset."],
  impostazioni: [
    "Impostazioni",
    "Privacy, coordinate riservate e pubblicazione."
  ],
  audit: ["Audit log", "Traccia minimizzata delle operazioni amministrative."]
} as const;

type Section = keyof typeof sectionTitles;

function PageHeader({ section }: { section: Section }) {
  const [title, description] = sectionTitles[section];
  return (
    <header className="admin-page-header">
      <div>
        <p className="eyebrow">Amministrazione</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {section !== "audit" ? (
        <a className="admin-action" href="/admin/preview">
          Anteprima
        </a>
      ) : null}
    </header>
  );
}

export default async function AdminSectionPage({
  params
}: {
  params: Promise<{ section: string }>;
}) {
  const { section: rawSection } = await params;
  if (!(rawSection in sectionTitles)) notFound();
  const section = rawSection as Section;
  const db = getDatabase();

  if (section === "sito" || section === "matrimonio") {
    const key = section === "sito" ? "hero" : "wedding";
    return (
      <>
        <PageHeader section={section} />
        <StructuredEditor
          title={sectionTitles[section][0]}
          description="Campi testuali controllati, senza HTML libero."
          action={saveStructuredContentAction}
          hidden={{ key }}
          submitLabel="Salva contenuto"
          fields={[
            { name: "title", label: "Titolo", type: "text", required: true },
            { name: "description", label: "Testo", type: "textarea" },
            { name: "published", label: "Pubblicato", type: "checkbox" }
          ]}
        />
      </>
    );
  }

  if (section === "programma") {
    const rows = await db
      .select()
      .from(scheduleItems)
      .orderBy(asc(scheduleItems.sortOrder));
    return (
      <>
        <PageHeader section={section} />
        <StructuredEditor
          title="Nuovo appuntamento"
          description="Titolo, luogo e orari in formato strutturato."
          action={saveScheduleItemAction}
          fields={[
            { name: "title", label: "Titolo", type: "text", required: true },
            { name: "locationName", label: "Luogo", type: "text" },
            {
              name: "startsAt",
              label: "Inizio",
              type: "datetime-local",
              required: true
            },
            { name: "endsAt", label: "Fine", type: "datetime-local" },
            {
              name: "sortOrder",
              label: "Ordine",
              type: "number",
              defaultValue: rows.length
            },
            { name: "published", label: "Pubblicato", type: "checkbox" },
            { name: "description", label: "Descrizione", type: "textarea" }
          ]}
        />
        <SimpleTable
          headers={["Titolo", "Luogo", "Stato"]}
          rows={rows.map((row) => [
            row.title,
            row.locationName ?? "—",
            row.published ? "Pubblicato" : "Bozza"
          ])}
        />
      </>
    );
  }

  if (section === "storia") {
    const rows = await db
      .select()
      .from(storyMoments)
      .orderBy(asc(storyMoments.sortOrder));
    return (
      <>
        <PageHeader section={section} />
        <StructuredEditor
          title="Nuovo momento"
          description="Testo narrativo e data, senza editor HTML."
          action={saveStoryMomentAction}
          fields={[
            { name: "title", label: "Titolo", type: "text", required: true },
            { name: "occurredOn", label: "Data", type: "date" },
            {
              name: "sortOrder",
              label: "Ordine",
              type: "number",
              defaultValue: rows.length
            },
            { name: "published", label: "Pubblicato", type: "checkbox" },
            {
              name: "body",
              label: "Racconto",
              type: "textarea",
              required: true
            }
          ]}
        />
        <SimpleTable
          headers={["Titolo", "Ordine", "Stato"]}
          rows={rows.map((row) => [
            row.title,
            row.sortOrder,
            row.published ? "Pubblicato" : "Bozza"
          ])}
        />
      </>
    );
  }

  if (section === "dress-code") {
    const rows = await db
      .select()
      .from(dressCodeColors)
      .orderBy(asc(dressCodeColors.sortOrder));
    return (
      <>
        <PageHeader section={section} />
        <StructuredEditor
          title="Aggiungi un colore"
          description="Palette accessibile con nome e valore esadecimale."
          action={saveDressColorAction}
          fields={[
            { name: "name", label: "Nome", type: "text", required: true },
            {
              name: "hexColor",
              label: "Colore",
              type: "color",
              required: true,
              defaultValue: "#20342c"
            },
            {
              name: "sortOrder",
              label: "Ordine",
              type: "number",
              defaultValue: rows.length
            }
          ]}
        />
        <SimpleTable
          headers={["Nome", "Colore", "Ordine"]}
          rows={rows.map((row) => [row.name, row.hexColor, row.sortOrder])}
        />
      </>
    );
  }

  if (section === "regali") {
    const [categories, giftRows] = await Promise.all([
      db.select().from(giftCategories).orderBy(asc(giftCategories.sortOrder)),
      db
        .select()
        .from(gifts)
        .where(isNull(gifts.archivedAt))
        .orderBy(asc(gifts.sortOrder))
    ]);
    return (
      <>
        <PageHeader section={section} />
        <StructuredEditor
          title="Nuova categoria"
          description="Raggruppa i regali per ambiente o tema."
          action={saveGiftCategoryAction}
          fields={[
            { name: "name", label: "Nome", type: "text", required: true },
            { name: "slug", label: "Slug", type: "text", required: true },
            {
              name: "sortOrder",
              label: "Ordine",
              type: "number",
              defaultValue: categories.length
            }
          ]}
        />
        <StructuredEditor
          title="Nuovo regalo"
          description="Importi sempre espressi in centesimi."
          action={saveGiftAction}
          fields={[
            {
              name: "publicReference",
              label: "Riferimento pubblico",
              type: "text",
              required: true,
              defaultValue: `G-${randomUUID()}`
            },
            { name: "title", label: "Titolo", type: "text", required: true },
            {
              name: "categoryId",
              label: "Categoria",
              type: "select",
              options: [
                { label: "Nessuna", value: "" },
                ...categories.map((item) => ({
                  label: item.name,
                  value: item.id
                }))
              ]
            },
            {
              name: "priceCents",
              label: "Prezzo (centesimi)",
              type: "number",
              required: true
            },
            {
              name: "progressMode",
              label: "Progresso",
              type: "select",
              defaultValue: "discreet",
              options: [
                { label: "Discreto", value: "discreet" },
                { label: "Esatto", value: "exact" },
                { label: "Nascosto", value: "hidden" }
              ]
            },
            {
              name: "sortOrder",
              label: "Ordine",
              type: "number",
              defaultValue: giftRows.length
            },
            { name: "published", label: "Pubblicato", type: "checkbox" },
            { name: "description", label: "Descrizione", type: "textarea" }
          ]}
        />
        <SimpleTable
          headers={["Regalo", "Prezzo", "Stato"]}
          rows={giftRows.map((row) => [
            row.title,
            formatCurrency(row.priceCents),
            row.published ? "Pubblicato" : "Nascosto"
          ])}
        />
      </>
    );
  }

  if (section === "richieste") {
    const rows = await db
      .select()
      .from(giftIntents)
      .orderBy(desc(giftIntents.createdAt))
      .limit(200);
    return (
      <>
        <PageHeader section={section} />
        <table className="admin-table">
          <thead>
            <tr>
              <th>Riferimento</th>
              <th>Tipo</th>
              <th>Stato</th>
              <th>Richiesto</th>
              <th>Ricevuto</th>
              <th>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.publicReference}</td>
                <td>{row.kind}</td>
                <td>{row.status}</td>
                <td>{formatCurrency(row.amountCents)}</td>
                <td>
                  {row.receivedAmountCents == null
                    ? "—"
                    : formatCurrency(row.receivedAmountCents)}
                </td>
                <td>
                  <form
                    action={async (data) => {
                      "use server";
                      await verifyRequestAction(data);
                    }}
                  >
                    <input type="hidden" name="intentId" value={row.id} />
                    <input
                      type="hidden"
                      name="receivedAmountCents"
                      value={row.amountCents}
                    />
                    <input
                      type="hidden"
                      name="idempotencyKey"
                      value={randomUUID()}
                    />
                    <button className="admin-action" type="submit">
                      Verifica
                    </button>
                  </form>
                  <form
                    action={async (data) => {
                      "use server";
                      await rejectRequestAction(data);
                    }}
                  >
                    <input type="hidden" name="intentId" value={row.id} />
                    <input
                      type="hidden"
                      name="idempotencyKey"
                      value={randomUUID()}
                    />
                    <button type="submit">Rifiuta</button>
                  </form>
                  <form
                    action={async (data) => {
                      "use server";
                      await cancelRequestAction(data);
                    }}
                  >
                    <input type="hidden" name="intentId" value={row.id} />
                    <input
                      type="hidden"
                      name="idempotencyKey"
                      value={randomUUID()}
                    />
                    <button type="submit">Annulla</button>
                  </form>
                  <form
                    action={async (data) => {
                      "use server";
                      await saveRequestNoteAction(data);
                    }}
                  >
                    <input type="hidden" name="intentId" value={row.id} />
                    <input
                      name="note"
                      aria-label={`Nota ${row.publicReference}`}
                      defaultValue={row.adminNote ?? ""}
                    />
                    <button type="submit">Salva nota</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <a className="admin-action" href="/api/admin/requests/export">
          Esporta CSV sicuro
        </a>
      </>
    );
  }

  if (section === "media") {
    const rows = await db
      .select()
      .from(mediaAssets)
      .orderBy(desc(mediaAssets.createdAt));
    return (
      <>
        <PageHeader section={section} />
        <StructuredEditor
          title="Registra un media"
          description="Solo metadati; il caricamento Blob resta una boundary separata."
          action={saveMediaMetadataAction}
          fields={[
            {
              name: "pathname",
              label: "Percorso",
              type: "text",
              required: true
            },
            {
              name: "contentType",
              label: "Tipo",
              type: "select",
              options: [
                "image/jpeg",
                "image/png",
                "image/webp",
                "video/mp4"
              ].map((value) => ({ label: value, value }))
            },
            {
              name: "sizeBytes",
              label: "Dimensione (byte)",
              type: "number",
              required: true
            },
            {
              name: "altText",
              label: "Testo alternativo",
              type: "textarea",
              required: true
            }
          ]}
        />
        <SimpleTable
          headers={["Percorso", "Tipo", "Alt"]}
          rows={rows.map((row) => [row.pathname, row.contentType, row.altText])}
        />
      </>
    );
  }

  if (section === "impostazioni") {
    const principal = await getAdminPrincipal();
    const readiness = principal?.role === "owner" ? await loadReadiness() : [];
    return (
      <>
        <PageHeader section={section} />
        {principal?.role === "owner" ? (
          <>
            <StructuredEditor
              title="Impostazioni generali"
              description="Controlli di privacy e durata delle richieste."
              action={saveAdminSettingsAction}
              fields={[
                {
                  name: "privacyReviewed",
                  label: "Privacy verificata",
                  type: "checkbox"
                },
                {
                  name: "requestHoldHours",
                  label: "Durata riserva (ore)",
                  type: "number",
                  defaultValue: 48
                },
                {
                  name: "publicContactLabel",
                  label: "Etichetta contatto",
                  type: "text"
                }
              ]}
            />
            <StructuredEditor
              title="Coordinate bancarie"
              description="Cifrate sul server; i valori correnti non entrano nel bundle iniziale."
              action={saveBankingAction}
              submitLabel="Cifra e salva"
              fields={[
                {
                  name: "accountHolder",
                  label: "Intestatario",
                  type: "text",
                  required: true
                },
                { name: "iban", label: "IBAN", type: "text", required: true },
                { name: "bankName", label: "Banca", type: "text" },
                { name: "instructions", label: "Istruzioni", type: "textarea" }
              ]}
            />
            <BankingReveal />
            <section className="admin-editor">
              <p className="eyebrow">Readiness</p>
              <h2>Prima di pubblicare</h2>
              <ul>
                {readiness.map((item) => (
                  <li key={item.key}>
                    {item.ready ? "✓" : "○"} {item.label}
                  </li>
                ))}
              </ul>
              <form
                action={async (data) => {
                  "use server";
                  await publishSiteAction(data);
                }}
              >
                <label>
                  Scrivi PUBBLICA per confermare{" "}
                  <input name="confirmation" required />
                </label>
                <button className="admin-action" type="submit">
                  Pubblica il sito
                </button>
              </form>
              <form
                action={async () => {
                  "use server";
                  await unpublishSiteAction();
                }}
              >
                <button type="submit">Revoca pubblicazione</button>
              </form>
            </section>
          </>
        ) : (
          <p>Le impostazioni sensibili richiedono il ruolo proprietario.</p>
        )}
      </>
    );
  }

  const rows = await db
    .select()
    .from(auditLogs)
    .orderBy(desc(auditLogs.createdAt))
    .limit(250);
  return (
    <>
      <PageHeader section="audit" />
      <table className="admin-table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Azione</th>
            <th>Tipo</th>
            <th>Attore</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.createdAt.toLocaleString("it-IT")}</td>
              <td>{row.action}</td>
              <td>{row.targetType}</td>
              <td>{row.actorType}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function SimpleTable({
  headers,
  rows
}: {
  headers: string[];
  rows: Array<Array<string | number>>;
}) {
  return (
    <table className="admin-table">
      <thead>
        <tr>
          {headers.map((header) => (
            <th key={header}>{header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {row.map((cell, cellIndex) => (
              <td key={`${rowIndex}-${cellIndex}`}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
