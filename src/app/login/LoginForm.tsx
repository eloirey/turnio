"use client";

import { useActionState, useState } from "react";
import { ui } from "@/components/ui";
import { signIn, signUp, type AuthState } from "./actions";

export function LoginForm() {
  const [mode, setMode] = useState<"entrar" | "registro">("entrar");
  const [inState, inAction, inPending] = useActionState<AuthState, FormData>(signIn, {});
  const [upState, upAction, upPending] = useActionState<AuthState, FormData>(signUp, {});

  const isSignUp = mode === "registro";
  const state = isSignUp ? upState : inState;
  const pending = isSignUp ? upPending : inPending;

  return (
    <div className={`${ui.card} w-full max-w-md p-7`}>
      <div className="mb-6 grid grid-cols-2 rounded-xl bg-ground p-1" role="tablist">
        {(["entrar", "registro"] as const).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`h-11 rounded-lg text-sm font-semibold ${mode === m ? "bg-surface shadow-sm" : "text-ink-muted"}`}
          >
            {m === "entrar" ? "Entrar" : "Crear cuenta"}
          </button>
        ))}
      </div>

      <form action={isSignUp ? upAction : inAction} className="flex flex-col gap-4" key={mode}>
        <label className={ui.label}>
          Email
          <input name="email" type="email" required autoComplete="email" defaultValue={state.email} className={ui.input} />
        </label>
        <label className={ui.label}>
          Contraseña
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete={isSignUp ? "new-password" : "current-password"}
            className={ui.input}
          />
          {isSignUp && <span className="text-xs font-normal text-ink-muted">Mínimo 8 caracteres.</span>}
        </label>

        {state.error && <p className={ui.error} role="alert">{state.error}</p>}
        {state.message && <p className={ui.success} role="status">{state.message}</p>}

        <button type="submit" disabled={pending} className={`${ui.btn} ${ui.primary} mt-1`}>
          {pending ? "Un momento…" : isSignUp ? "Crear cuenta gratis" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
