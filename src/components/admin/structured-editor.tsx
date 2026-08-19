"use client";

import { useActionState } from "react";

import type { AdminActionResult } from "@/actions/admin/shared";

type EditorField = {
  name: string;
  label: string;
  type:
    | "text"
    | "textarea"
    | "number"
    | "date"
    | "datetime-local"
    | "checkbox"
    | "color"
    | "email"
    | "select";
  required?: boolean;
  defaultValue?: string | number | boolean;
  options?: Array<{ label: string; value: string }>;
};

export function StructuredEditor(props: {
  title: string;
  description: string;
  action: (formData: FormData) => Promise<AdminActionResult>;
  fields: EditorField[];
  hidden?: Record<string, string>;
  submitLabel?: string;
}) {
  const [state, submit, pending] = useActionState(
    async (_state: AdminActionResult | null, formData: FormData) =>
      props.action(formData),
    null
  );

  return (
    <section className="admin-editor">
      <header>
        <p className="eyebrow">Editor strutturato</p>
        <h2>{props.title}</h2>
        <p>{props.description}</p>
      </header>
      <form action={submit}>
        {Object.entries(props.hidden ?? {}).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <div className="admin-field-grid">
          {props.fields.map((field) => (
            <label
              key={field.name}
              className={
                field.type === "textarea" ? "admin-field-wide" : undefined
              }
            >
              <span>{field.label}</span>
              {field.type === "textarea" ? (
                <textarea
                  name={field.name}
                  required={field.required}
                  defaultValue={String(field.defaultValue ?? "")}
                  rows={5}
                />
              ) : field.type === "select" ? (
                <select
                  name={field.name}
                  required={field.required}
                  defaultValue={String(field.defaultValue ?? "")}
                >
                  {field.options?.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  name={field.name}
                  type={field.type}
                  required={field.required}
                  defaultChecked={
                    field.type === "checkbox"
                      ? Boolean(field.defaultValue)
                      : undefined
                  }
                  defaultValue={
                    field.type !== "checkbox"
                      ? String(field.defaultValue ?? "")
                      : undefined
                  }
                />
              )}
            </label>
          ))}
        </div>
        <div className="admin-form-footer">
          <button type="submit" disabled={pending}>
            {pending ? "Salvataggio…" : (props.submitLabel ?? "Salva bozza")}
          </button>
          {state ? (
            <p role="status" data-tone={state.ok ? "success" : "error"}>
              {state.message}
            </p>
          ) : null}
        </div>
      </form>
    </section>
  );
}
