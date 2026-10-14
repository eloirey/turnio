"use client";

import { useActionState } from "react";
import { ui } from "@/components/ui";
import { ROLES, ROLE_LABELS, ROLE_STYLES } from "@/lib/roles";
import { createLocal, type OnboardingState } from "./actions";

export function OnboardingForm() {
  const [state, action, pending] = useActionState<OnboardingState, FormData>(createLocal, {});
  return (
    <form action={action} className={`${ui.card} flex w-full max-w-lg flex-col gap-6 p-7`}>
      <label className={ui.label}>
        ¿Cómo se llama tu local?
        <input name="nombre" required maxLength={120} placeholder="Bar Ejemplo" className={ui.input} autoFocus />
      </label>

      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-2.5 text-sm font-semibold">¿Qué puestos tiene tu equipo?</legend>
        {ROLES.map((r) => (
          <label key={r} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-[10px] border border-line px-3">
            <input type="checkbox" name="puestos" value={r} defaultChecked className="h-5 w-5 accent-accent" />
            <span className={`rounded-md px-2 py-0.5 text-sm font-semibold ${ROLE_STYLES[r]}`}>{ROLE_LABELS[r]}</span>
          </label>
        ))}
        <p className="text-xs text-ink-muted">
          Crearemos una plantilla de necesidades de ejemplo con estos puestos. La podrás ajustar después.
        </p>
      </fieldset>

      {state.error && <p className={ui.error} role="alert">{state.error}</p>}
      <button type="submit" disabled={pending} className={`${ui.btn} ${ui.primary}`}>
        {pending ? "Creando…" : "Crear mi local"}
      </button>
    </form>
  );
}
