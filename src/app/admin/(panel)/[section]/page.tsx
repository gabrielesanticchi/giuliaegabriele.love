import { randomUUID } from "node:crypto";

import { asc, desc, isNull } from "drizzle-orm";
import { notFound } from "next/navigation";

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
  processPendingEmailDeliveriesAction,
  rejectRequestAction,
  resendRequestEmailAction,
  saveRequestNoteAction,
  unlockRequestAction,
  verifyRequestAction
} from "@/actions/admin/requests";
import { saveBankingAction } from "@/actions/admin/settings";
import { StructuredEditor } from "@/components/admin/structured-editor";
import { BankingReveal } from "@/components/admin/banking-reveal";
import { getDatabase } from "@/db";
import { giftCategories, giftIntents, gifts } from "@/db/schema";
import { getAdminPrincipal } from "@/lib/auth/session";
import { formatCurrency } from "@/lib/domain/currency";

export const dynamic = "force-dynamic";

const sectionTitles = {
  regali: ["Lista nozze", "Categorie, regali e stato di pubblicazione."],
  richieste: ["Richieste", "Verifiche manuali e stato dei contributi."],
  impostazioni: ["Impostazioni", "Coordinate bancarie riservate."]
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
          description="Importi sempre espressi in euro interi."
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
              name: "priceEuros",
              label: "Prezzo (euro)",
              type: "number",
              required: true
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
                <td>{formatCurrency(row.priceEuros)}</td>
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
                          name: "priceEuros",
                          label: "Prezzo (euro)",
                          type: "number",
                          required: true,
                          defaultValue: row.priceEuros
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
              name: "amountEuros",
              label: "Importo ricevuto (euro)",
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
                <td>{formatCurrency(row.amountEuros)}</td>
                <td>
                  {row.receivedAmountEuros == null
                    ? "—"
                    : formatCurrency(row.receivedAmountEuros)}
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
                      name="receivedAmountEuros"
                      defaultValue={row.receivedAmountEuros ?? row.amountEuros}
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
        <div className="admin-outbox">
          <form
            action={async () => {
              "use server";
              await processPendingEmailDeliveriesAction();
            }}
          >
            <button className="admin-action" type="submit">
              Invia email in attesa
            </button>
          </form>
          <p className="admin-hint">
            Elabora in batch le notifiche email in attesa o non riuscite,
            riutilizzando la stessa chiave di idempotenza del provider.
          </p>
        </div>
        <a className="admin-action" href="/api/admin/requests/export">
          Esporta CSV sicuro
        </a>
      </>
    );
  }

  if (section === "impostazioni") {
    const principal = await getAdminPrincipal();
    return (
      <>
        <PageHeader section={section} />
        {principal?.role === "owner" ? (
          <>
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
          </>
        ) : (
          <p>Le impostazioni sensibili richiedono il ruolo proprietario.</p>
        )}
      </>
    );
  }

  notFound();
}
