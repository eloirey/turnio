"use client";

import { useActionState } from "react";
import { ui } from "@/components/ui";
import { requestPasswordReset, type AuthState } from "../login/actions";

export function ResetForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(requestPasswordReset, {});
  return (
    <form action={action} className={`${ui.card} flex w-full max-w-md flex-col gap-4 p-7`}>
      <div>
        <h1 className="font-display text-2xl font-bold">¿Has olvidado la contraseña?</h1>
        <p className="mt-1 text-sm text-ink-soft">Escribe tu email y te enviaremos un enlace para elegir una nueva.</p>
      </div>
      <label className={ui.label}>
        Email
        <input name="email" type="email" required autoComplete="email" defaultValue={state.email} className={ui.input} autoFocus />
      </label>
      {state.error && (
        <p className={ui.error} role="alert">
          {state.error}
        </p>
      )}
      {state.message && (
        <p className={ui.success} role="status">
          {state.message}
        </p>
      )}
      <button type="submit" disabled={pending} className={`${ui.btn} ${ui.primary}`}>
        {pending ? "Enviando…" : "Enviar enlace"}
      </button>
    </form>
  );
}
