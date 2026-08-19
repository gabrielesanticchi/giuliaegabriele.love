import { randomUUID } from "node:crypto";

import { asc, desc, eq, isNull } from "drizzle-orm";
import { notFound } from "next/navigation";

import {
  deleteDressColorAction,
  deleteMediaMetadataAction,
  deleteScheduleItemAction,
  deleteStoryMomentAction,
  saveDressColorAction,
  saveMediaMetadataAction,
  saveScheduleItemAction,
  saveStoryMomentAction,
  saveStructuredContentAction
} from "@/actions/admin/content";
import {
  archiveGiftAction,
  archiveGiftCategoryAction,
  duplicateGiftAction,
  saveGiftAction,
  saveGiftCategoryAction,
  setGiftPublishedAction
} from "@/actions/admin/gifts";
import {
  cancelRequestAction,
  createManualRequestAction,
  extendRequestAction,
  rejectRequestAction,
  resendRequestEmailAction,
  saveRequestNoteAction,
  unlockRequestAction,
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
  siteSettings,
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
    const existingRows = await db
      .select({ value: siteSettings.value })
      .from(siteSettings)
      .where(eq(siteSettings.key, key))
      .limit(1);
    const existing = (existingRows[0]?.value ?? {}) as {
      title?: string;
      description?: string;
      published?: boolean;
      weddingDate?: string;
      displayDate?: string;
      place?: string;
    };
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
            {
              name: "title",
              label: "Titolo",
              type: "text",
              required: true,
              defaultValue: existing.title ?? ""
            },
            {
              name: "description",
              label: "Testo",
              type: "textarea",
              defaultValue: existing.description ?? ""
            },
            ...(section === "matrimonio"
              ? [
                  {
                    name: "weddingDate",
                    label: "Data ISO con fuso",
                    type: "text" as const,
                    required: true,
                    defaultValue: existing.weddingDate ?? ""
                  },
                  {
                    name: "displayDate",
                    label: "Data visualizzata",
                    type: "text" as const,
                    defaultValue: existing.displayDate ?? ""
                  },
                  {
                    name: "place",
                    label: "Luogo",
                    type: "text" as const,
                    defaultValue: existing.place ?? ""
                  }
                ]
              : []),
            {
              name: "published",
              label: "Pubblicato",
              type: "checkbox",
              defaultValue: existing.published === true
            }
          ]}
        />
      </>
    );
  }

  if (section === "programma") {
    const rows = await db
      .select()
      .from(scheduleItems)
      .where(isNull(scheduleItems.archivedAt))
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
        {rows.map((row) => (
          <details key={`edit-${row.id}`} className="admin-editor">
            <summary>Modifica / riordina / archivia: {row.title}</summary>
            <StructuredEditor
              title={row.title}
              description="Modifica contenuto, ordine e pubblicazione."
              action={saveScheduleItemAction}
              hidden={{ id: row.id }}
              fields={[
                {
                  name: "title",
                  label: "Titolo",
                  type: "text",
                  required: true,
                  defaultValue: row.title
                },
                {
                  name: "locationName",
                  label: "Luogo",
                  type: "text",
                  defaultValue: row.locationName ?? ""
                },
                {
                  name: "startsAt",
                  label: "Inizio",
                  type: "datetime-local",
                  required: true,
                  defaultValue: row.startsAt.toISOString().slice(0, 16)
                },
                {
                  name: "endsAt",
                  label: "Fine",
                  type: "datetime-local",
                  defaultValue: row.endsAt?.toISOString().slice(0, 16) ?? ""
                },
                {
                  name: "sortOrder",
                  label: "Ordine",
                  type: "number",
                  defaultValue: row.sortOrder
                },
                {
                  name: "published",
                  label: "Pubblicato",
                  type: "checkbox",
                  defaultValue: row.published
                },
                {
                  name: "description",
                  label: "Descrizione",
                  type: "textarea",
                  defaultValue: row.description ?? ""
                }
              ]}
            />
            <form action={deleteScheduleItemAction.bind(null, row.id)}>
              <button type="submit">Elimina</button>
            </form>
          </details>
        ))}
      </>
    );
  }

  if (section === "storia") {
    const rows = await db
      .select()
      .from(storyMoments)
      .where(isNull(storyMoments.archivedAt))
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
        {rows.map((row) => (
          <details key={`edit-${row.id}`} className="admin-editor">
            <summary>Modifica / riordina / archivia: {row.title}</summary>
            <StructuredEditor
              title={row.title}
              description="Modifica contenuto, ordine e pubblicazione."
              action={saveStoryMomentAction}
              hidden={{ id: row.id }}
              fields={[
                {
                  name: "title",
                  label: "Titolo",
                  type: "text",
                  required: true,
                  defaultValue: row.title
                },
                {
                  name: "occurredOn",
                  label: "Data",
                  type: "date",
                  defaultValue: row.occurredOn?.toISOString().slice(0, 10) ?? ""
                },
                {
                  name: "sortOrder",
                  label: "Ordine",
                  type: "number",
                  defaultValue: row.sortOrder
                },
                {
                  name: "published",
                  label: "Pubblicato",
                  type: "checkbox",
                  defaultValue: row.published
                },
                {
                  name: "body",
                  label: "Racconto",
                  type: "textarea",
                  required: true,
                  defaultValue: row.body
                }
              ]}
            />
            <form action={deleteStoryMomentAction.bind(null, row.id)}>
              <button type="submit">Elimina</button>
            </form>
          </details>
        ))}
      </>
    );
  }

  if (section === "dress-code") {
    const [rows, dressRows] = await Promise.all([
      db
        .select()
        .from(dressCodeColors)
        .where(isNull(dressCodeColors.archivedAt))
        .orderBy(asc(dressCodeColors.sortOrder)),
      db
        .select({ value: siteSettings.value })
        .from(siteSettings)
        .where(eq(siteSettings.key, "dress_code"))
        .limit(1)
    ]);
    const dress = (dressRows[0]?.value ?? {}) as {
      title?: string;
      description?: string;
      published?: boolean;
    };
    return (
      <>
        <PageHeader section={section} />
        <StructuredEditor
          title="Testo dress code"
          description="Titolo e invito mostrati nella sezione pubblica."
          action={saveStructuredContentAction}
          hidden={{ key: "dress_code" }}
          fields={[
            {
              name: "title",
              label: "Titolo",
              type: "text",
              required: true,
              defaultValue: dress.title ?? ""
            },
            {
              name: "description",
              label: "Descrizione",
              type: "textarea",
              defaultValue: dress.description ?? ""
            },
            {
              name: "published",
              label: "Pubblicato",
              type: "checkbox",
              defaultValue: dress.published === true
            }
          ]}
        />
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
        {rows.map((row) => (
          <details key={`edit-${row.id}`} className="admin-editor">
            <summary>Modifica / riordina: {row.name}</summary>
            <StructuredEditor
              title={row.name}
              description="Aggiorna colore e ordine."
              action={saveDressColorAction}
              hidden={{ id: row.id }}
              fields={[
                {
                  name: "name",
                  label: "Nome",
                  type: "text",
                  required: true,
                  defaultValue: row.name
                },
                {
                  name: "hexColor",
                  label: "Colore",
                  type: "color",
                  required: true,
                  defaultValue: row.hexColor
                },
                {
                  name: "sortOrder",
                  label: "Ordine",
                  type: "number",
                  defaultValue: row.sortOrder
                }
              ]}
            />
            <form action={deleteDressColorAction.bind(null, row.id)}>
              <button type="submit">Elimina</button>
            </form>
          </details>
        ))}
      </>
    );
  }

  if (section === "regali") {
    const [categories, giftRows] = await Promise.all([
      db
        .select()
        .from(giftCategories)
        .where(isNull(giftCategories.archivedAt))
        .orderBy(asc(giftCategories.sortOrder)),
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
        {categories.map((category) => (
          <details key={`category-${category.id}`} className="admin-editor">
            <summary>Modifica / riordina categoria: {category.name}</summary>
            <StructuredEditor
              title={category.name}
              description="Aggiorna nome, slug e ordine."
              action={saveGiftCategoryAction}
              hidden={{ id: category.id }}
              fields={[
                {
                  name: "name",
                  label: "Nome",
                  type: "text",
                  required: true,
                  defaultValue: category.name
                },
                {
                  name: "slug",
                  label: "Slug",
                  type: "text",
                  required: true,
                  defaultValue: category.slug
                },
                {
                  name: "sortOrder",
                  label: "Ordine",
                  type: "number",
                  defaultValue: category.sortOrder
                }
              ]}
            />
            <form action={archiveGiftCategoryAction.bind(null, category.id)}>
              <button type="submit">Archivia categoria</button>
            </form>
          </details>
        ))}
        <table className="admin-table">
          <thead>
            <tr>
              <th>Regalo</th>
              <th>Prezzo</th>
              <th>Stato</th>
              <th>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {giftRows.map((row) => (
              <tr key={row.id}>
                <td>{row.title}</td>
                <td>{formatCurrency(row.priceCents)}</td>
                <td>{row.published ? "Pubblicato" : "Nascosto"}</td>
                <td>
                  <details>
                    <summary>Modifica / riordina</summary>
                    <StructuredEditor
                      title={row.title}
                      description="Aggiorna regalo, categoria, importo e ordine."
                      action={saveGiftAction}
                      hidden={{ id: row.id }}
                      fields={[
                        {
                          name: "publicReference",
                          label: "Riferimento pubblico",
                          type: "text",
                          required: true,
                          defaultValue: row.publicReference
                        },
                        {
                          name: "title",
                          label: "Titolo",
                          type: "text",
                          required: true,
                          defaultValue: row.title
                        },
                        {
                          name: "categoryId",
                          label: "Categoria",
                          type: "select",
                          defaultValue: row.categoryId ?? "",
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
                          required: true,
                          defaultValue: row.priceCents
                        },
                        {
                          name: "progressMode",
                          label: "Progresso",
                          type: "select",
                          defaultValue: row.progressMode,
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
                          defaultValue: row.sortOrder
                        },
                        {
                          name: "published",
                          label: "Pubblicato",
                          type: "checkbox",
                          defaultValue: row.published
                        },
                        {
                          name: "description",
                          label: "Descrizione",
                          type: "textarea",
                          defaultValue: row.description ?? ""
                        }
                      ]}
                    />
                  </details>
                  <form
                    action={async () => {
                      "use server";
                      await setGiftPublishedAction(row.id, !row.published);
                    }}
                  >
                    <button type="submit">
                      {row.published ? "Nascondi" : "Pubblica"}
                    </button>
                  </form>
                  <form
                    action={async () => {
                      "use server";
                      await duplicateGiftAction(row.id);
                    }}
                  >
                    <button type="submit">Duplica</button>
                  </form>
                  <form
                    action={async () => {
                      "use server";
                      await archiveGiftAction(row.id);
                    }}
                  >
                    <button type="submit">Archivia</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
        <StructuredEditor
          title="Inserimento manuale"
          description="Crea una richiesta rispettando lock e disponibilità del regalo."
          action={createManualRequestAction}
          hidden={{ idempotencyKey: randomUUID() }}
          fields={[
            {
              name: "giftId",
              label: "ID regalo",
              type: "text",
              required: true
            },
            {
              name: "kind",
              label: "Tipo",
              type: "select",
              options: [
                { label: "Regalo completo", value: "full_gift" },
                { label: "Contributo", value: "contribution" }
              ]
            },
            {
              name: "method",
              label: "Metodo",
              type: "select",
              options: [
                { label: "Bonifico", value: "bank_transfer" },
                { label: "Acquisto esterno", value: "external_purchase" }
              ]
            },
            {
              name: "amountCents",
              label: "Importo ricevuto (centesimi)",
              type: "number",
              required: true
            },
            { name: "firstName", label: "Nome", type: "text", required: true },
            {
              name: "lastName",
              label: "Cognome",
              type: "text",
              required: true
            },
            { name: "email", label: "Email", type: "email", required: true }
          ]}
        />
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
                      type="number"
                      name="receivedAmountCents"
                      defaultValue={row.receivedAmountCents ?? row.amountCents}
                      min={0}
                      aria-label={`Importo ricevuto ${row.publicReference}`}
                      required
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
                      await unlockRequestAction(data);
                    }}
                  >
                    <input type="hidden" name="intentId" value={row.id} />
                    <input
                      type="hidden"
                      name="idempotencyKey"
                      value={randomUUID()}
                    />
                    <button type="submit">Sblocca</button>
                  </form>
                  <form
                    action={async (data) => {
                      "use server";
                      await extendRequestAction(data);
                    }}
                  >
                    <input type="hidden" name="intentId" value={row.id} />
                    <input
                      type="hidden"
                      name="idempotencyKey"
                      value={randomUUID()}
                    />
                    <input
                      type="datetime-local"
                      name="expiresAt"
                      aria-label={`Nuova scadenza ${row.publicReference}`}
                      required
                    />
                    <button type="submit">Estendi</button>
                  </form>
                  <form
                    action={async (data) => {
                      "use server";
                      await resendRequestEmailAction(data);
                    }}
                  >
                    <input type="hidden" name="intentId" value={row.id} />
                    <input
                      type="hidden"
                      name="idempotencyKey"
                      value={randomUUID()}
                    />
                    <button type="submit">Reinvia email</button>
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
                      type="hidden"
                      name="idempotencyKey"
                      value={randomUUID()}
                    />
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
    const [rows, mediaSettingRows] = await Promise.all([
      db
        .select()
        .from(mediaAssets)
        .where(isNull(mediaAssets.archivedAt))
        .orderBy(desc(mediaAssets.createdAt)),
      db
        .select({ value: siteSettings.value })
        .from(siteSettings)
        .where(eq(siteSettings.key, "media_settings"))
        .limit(1)
    ]);
    const mediaSettings = (mediaSettingRows[0]?.value ?? {}) as {
      requiredMediaIds?: string[];
    };
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
        <StructuredEditor
          title="Media obbligatori"
          description="ID media referenziati che devono esistere prima della pubblicazione."
          action={saveStructuredContentAction}
          hidden={{
            key: "media_settings",
            title: "Media obbligatori",
            description: ""
          }}
          fields={[
            {
              name: "requiredMediaIds",
              label: "ID separati da virgola",
              type: "text",
              required: true,
              defaultValue: mediaSettings.requiredMediaIds?.join(", ") ?? ""
            },
            {
              name: "published",
              label: "Configurazione verificata",
              type: "checkbox",
              defaultValue: true
            }
          ]}
        />
        <SimpleTable
          headers={["Percorso", "Tipo", "Alt"]}
          rows={rows.map((row) => [row.pathname, row.contentType, row.altText])}
        />
        {rows.map((row) => (
          <details key={`edit-${row.id}`} className="admin-editor">
            <summary>Modifica / elimina: {row.pathname}</summary>
            <StructuredEditor
              title={row.pathname}
              description="Aggiorna metadati e testo alternativo."
              action={saveMediaMetadataAction}
              hidden={{ id: row.id }}
              fields={[
                {
                  name: "pathname",
                  label: "Percorso",
                  type: "text",
                  required: true,
                  defaultValue: row.pathname
                },
                {
                  name: "contentType",
                  label: "Tipo",
                  type: "select",
                  defaultValue: row.contentType,
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
                  required: true,
                  defaultValue: row.sizeBytes
                },
                {
                  name: "altText",
                  label: "Testo alternativo",
                  type: "textarea",
                  required: true,
                  defaultValue: row.altText
                }
              ]}
            />
            <form action={deleteMediaMetadataAction.bind(null, row.id)}>
              <button type="submit">Elimina</button>
            </form>
          </details>
        ))}
      </>
    );
  }

  if (section === "impostazioni") {
    const principal = await getAdminPrincipal();
    const readiness = principal?.role === "owner" ? await loadReadiness() : [];
    const settingsRows = await db
      .select({ value: siteSettings.value })
      .from(siteSettings)
      .where(eq(siteSettings.key, "admin_settings"))
      .limit(1);
    const currentSettings = (settingsRows[0]?.value ?? {}) as {
      privacyReviewed?: boolean;
      requestHoldHours?: number;
      publicContactLabel?: string;
    };
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
                  type: "checkbox",
                  defaultValue: currentSettings.privacyReviewed === true
                },
                {
                  name: "requestHoldHours",
                  label: "Durata riserva (ore)",
                  type: "number",
                  defaultValue: currentSettings.requestHoldHours ?? 48
                },
                {
                  name: "publicContactLabel",
                  label: "Etichetta contatto",
                  type: "text",
                  defaultValue: currentSettings.publicContactLabel ?? ""
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
