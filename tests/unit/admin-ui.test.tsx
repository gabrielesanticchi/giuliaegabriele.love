import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AdminNavigation } from "@/components/admin/admin-navigation";
import { StructuredEditor } from "@/components/admin/structured-editor";

describe("admin editorial interface", () => {
  it("exposes the complete Italian navigation", () => {
    render(<AdminNavigation />);

    for (const label of [
      "Panoramica",
      "Sito e Hero",
      "Il matrimonio",
      "La nostra storia",
      "Lista nozze",
      "Richieste",
      "Media",
      "Impostazioni",
      "Audit log"
    ]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
  });

  it("renders constrained fields rather than a free-form HTML editor", () => {
    render(
      <StructuredEditor
        title="Sito e Hero"
        description="Contenuti principali"
        action={async () => ({ ok: true, message: "salvato" })}
        hidden={{ key: "hero" }}
        fields={[
          { name: "title", label: "Titolo", type: "text" },
          { name: "description", label: "Testo", type: "textarea" }
        ]}
      />
    );

    expect(screen.getByRole("textbox", { name: "Titolo" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Testo" })).toBeInTheDocument();
    expect(document.querySelector("[contenteditable]")).toBeNull();
  });
});
