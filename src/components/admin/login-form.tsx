"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

export function LoginForm() {
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const result = await signIn("credentials", {
      email: form.get("email"),
      password: form.get("password"),
      code: form.get("code"),
      callbackUrl: searchParams.get("callbackUrl") || "/admin",
      redirect: false
    });
    if (!result?.ok) {
      setError("Credenziali non valide");
      setPending(false);
      return;
    }
    window.location.assign(result.url ?? "/admin");
  }

  return (
    <form onSubmit={submit} className="admin-login-form">
      <label>
        <span>Email</span>
        <input name="email" type="email" autoComplete="username" required />
      </label>
      <label>
        <span>Password</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </label>
      <label>
        <span>Codice autenticatore o recupero</span>
        <input name="code" autoComplete="one-time-code" />
      </label>
      <button type="submit" disabled={pending}>
        {pending ? "Accesso…" : "Accedi"}
      </button>
      {error ? <p role="alert">{error}</p> : null}
    </form>
  );
}
