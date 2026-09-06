import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AdminNavigation } from "@/components/admin/admin-navigation";
import { StructuredEditor } from "@/components/admin/structured-editor";

describe("admin operational interface", () => {
  it("exposes only the Lista Nozze operational navigation", () => {
    render(<AdminNavigation />);

    const expected = ["Panoramica", "Lista nozze", "Richieste", "Impostazioni"];
    for (const label of expected) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
    expect(screen.getAllByRole("link")).toHaveLength(expected.length);
  });

  it("renders constrained fields rather than a free-form HTML editor", () => {
    render(
      <StructuredEditor
        title="Lista nozze"
        description="Nuovo regalo"
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
