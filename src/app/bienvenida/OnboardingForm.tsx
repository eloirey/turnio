"use client";

import { useActionState, useState } from "react";
import { ui } from "@/components/ui";
import { roleStyle } from "@/lib/roles";
import { ROLE_PRESETS } from "@/lib/schedule/templates";
import { createLocal, type OnboardingState } from "./actions";

export function OnboardingForm() {
  const [state, action, pending] = useActionState<OnboardingState, FormData>(createLocal, {});
  const [preset, setPreset] = useState("hosteleria");
  const [roles, setRoles] = useState<string[]>(ROLE_PRESETS.hosteleria.roles);

  function pick(key: string) {
    setPreset(key);
    setRoles(ROLE_PRESETS[key].roles);
  }

  return (
    <form action={action} className={`${ui.card} flex w-full max-w-xl flex-col gap-7 p-6 sm:p-8`}>
      <label className={ui.label}>
        ¿Cómo se llama tu negocio?
        <input name="nombre" required maxLength={120} placeholder="Bar La Plaza" className={ui.input} autoFocus />
      </label>

      <fieldset>
        <legend className="mb-3 text-sm font-semibold">¿A qué se dedica?</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {Object.entries(ROLE_PRESETS).map(([key, p]) => (
            <label
              key={key}
              className={`flex min-h-12 cursor-pointer items-center rounded-xl px-4 text-[15px] ${preset === key ? "border-2 border-ink bg-ground font-semibold" : "border border-line-strong hover:border-ink"}`}
            >
              <input type="radio" name="tipo" value={key} checked={preset === key} onChange={() => pick(key)} className="sr-only" />
              {p.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-1 text-sm font-semibold">Puestos de tu equipo</legend>
        <p className="mb-3 text-[13px] text-ink-muted">Cámbialos a tu gusto. Podrás editarlos después en Ajustes.</p>
        <div className="flex flex-col gap-2">
          {roles.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="h-11 w-3 flex-none rounded-full" style={{ backgroundColor: roleStyle(i).backgroundColor, boxShadow: `inset 0 0 0 1px ${roleStyle(i).color}40` }} />
              <input
                name="puesto"
                value={r}
                onChange={(e) => setRoles((l) => l.map((x, j) => (j === i ? e.target.value : x)))}
                maxLength={40}
                placeholder="Nombre del puesto"
                aria-label={`Puesto ${i + 1}`}
                className={`${ui.input} flex-1`}
              />
              <button
                type="button"
                onClick={() => setRoles((l) => l.filter((_, j) => j !== i))}
                disabled={roles.length === 1}
                aria-label="Quitar puesto"
                className="flex h-11 w-11 flex-none items-center justify-center rounded-[10px] text-ink-muted hover:bg-ground disabled:opacity-30"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setRoles((l) => [...l, ""])} className="mt-3 min-h-11 text-sm font-semibold text-accent hover:underline">
          + Añadir otro puesto
        </button>
      </fieldset>

      {state.error && (
        <p className={ui.error} role="alert">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className={`${ui.btn} ${ui.primary} h-12 text-base`}>
        {pending ? "Preparando tu local…" : "Crear mi local"}
      </button>
    </form>
  );
}
