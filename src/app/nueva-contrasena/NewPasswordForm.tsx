"use client";

import { useActionState } from "react";
import { ui } from "@/components/ui";
import { updatePassword, type AuthState } from "../login/actions";

export function NewPasswordForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(updatePassword, {});
  return (
    <form action={action} className={`${ui.card} flex w-full max-w-md flex-col gap-4 p-7`}>
      <div>
        <h1 className="font-display text-2xl font-bold">Elige una contraseña nueva</h1>
        <p className="mt-1 text-sm text-ink-soft">Mínimo 8 caracteres. Después entrarás directamente.</p>
      </div>
      <label className={ui.label}>
        Contraseña nueva
        <input name="password" type="password" required minLength={8} autoComplete="new-password" className={ui.input} autoFocus />
      </label>
      <label className={ui.label}>
        Repítela
        <input name="repeat" type="password" required minLength={8} autoComplete="new-password" className={ui.input} />
      </label>
      {state.error && (
        <p className={ui.error} role="alert">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className={`${ui.btn} ${ui.primary}`}>
        {pending ? "Guardando…" : "Guardar y entrar"}
      </button>
    </form>
  );
}
