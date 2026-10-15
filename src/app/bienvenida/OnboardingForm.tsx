"use client";

import { useActionState, useState, type FormEvent } from "react";
import { ui } from "@/components/ui";
import { firstError, onboardingSchema, type OnboardingInput } from "@/lib/forms";
import { roleStyle } from "@/lib/roles";
import { getTemplate, SECTOR_TEMPLATES } from "@/lib/schedule/templates";
import { createLocal, type OnboardingState } from "./actions";

interface Props {
  /** En la demo no hay servidor: el alta se hace en el navegador. */
  onCreate?: (input: { nombre: string; tipo: string; puestos: string[] }) => void;
  defaultName?: string;
}

/**
 * Alta del negocio en dos pasos: 1) a qué se dedica (elige una plantilla con
 * puestos, franjas y necesidades), 2) nombre y puestos.
 */
export function OnboardingForm({ onCreate, defaultName = "" }: Props) {
  const [state, action, pending] = useActionState<OnboardingState, FormData>(createLocal, {});
  const [step, setStep] = useState<1 | 2>(1);
  const [tipo, setTipo] = useState("bar");
  const [roles, setRoles] = useState<string[]>(getTemplate("bar").roles.map((r) => r.name));
  const [localError, setLocalError] = useState("");
  const template = getTemplate(tipo);

  function pick(key: string) {
    setTipo(key);
    setRoles(getTemplate(key).roles.map((r) => r.name));
    setStep(2);
  }

  function submitDemo(e: FormEvent<HTMLFormElement>) {
    if (!onCreate) return;
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const input: OnboardingInput = { nombre: String(fd.get("nombre") ?? ""), tipo, puestos: fd.getAll("puesto").map(String) };
    const parsed = onboardingSchema.safeParse(input);
    if (!parsed.success) return setLocalError(firstError(parsed.error));
    setLocalError("");
    onCreate(parsed.data);
  }

  const error = localError || state.error;

  return (
    <form action={onCreate ? undefined : action} onSubmit={submitDemo} className={`${ui.card} w-full max-w-3xl p-5 sm:p-8`}>
      <ol className="mb-6 flex items-center gap-3 text-sm font-semibold" aria-label="Pasos">
        <li className={`flex items-center gap-2 ${step === 1 ? "text-ink" : "text-ink-muted"}`}>
          <span className={`flex h-7 w-7 items-center justify-center rounded-full text-[13px] ${step === 1 ? "bg-accent text-white" : "bg-ok-soft text-accent"}`}>{step === 1 ? "1" : "✓"}</span>
          Tu sector
        </li>
        <li aria-hidden className="h-px w-8 bg-line-strong" />
        <li className={`flex items-center gap-2 ${step === 2 ? "text-ink" : "text-ink-muted"}`}>
          <span className={`flex h-7 w-7 items-center justify-center rounded-full text-[13px] ${step === 2 ? "bg-accent text-white" : "border-2 border-line-strong"}`}>2</span>
          Tu negocio
        </li>
      </ol>
      <input type="hidden" name="tipo" value={tipo} />

      {step === 1 && (
        <fieldset>
          <legend className="mb-1 font-display text-xl font-bold">¿A qué se dedica tu negocio?</legend>
          <p className="mb-5 text-sm text-ink-soft">Te preparamos los puestos, las franjas y cuánta gente suele hacer falta. Luego lo ajustas a tu gusto.</p>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {SECTOR_TEMPLATES.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => pick(t.key)}
                aria-pressed={tipo === t.key}
                className={`group flex min-h-[86px] flex-col items-start justify-between gap-2 rounded-xl border p-3.5 text-left transition hover:-translate-y-px hover:border-ink hover:shadow-sm ${tipo === t.key ? "border-2 border-ink bg-ground" : "border-line-strong"}`}
              >
                <span>
                  <span className="block text-[15px] font-semibold leading-snug">{t.label}</span>
                  <span className="block text-[13px] text-ink-muted">{t.hint}</span>
                </span>
                <span className="flex gap-1" aria-hidden>
                  {t.roles.map((r) => (
                    <span key={r.name} className="h-2.5 w-6 rounded-full" style={{ backgroundColor: roleStyle(r.color).backgroundColor, boxShadow: `inset 0 0 0 1px ${roleStyle(r.color).color}33` }} />
                  ))}
                </span>
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-7">
          <div className="flex items-center justify-between gap-3 rounded-xl bg-ground px-4 py-3">
            <span className="text-sm">
              Plantilla: <strong>{template.label}</strong>
            </span>
            <button type="button" onClick={() => setStep(1)} className="min-h-9 text-sm font-semibold text-accent hover:underline">
              Cambiar
            </button>
          </div>

          <label className={ui.label}>
            ¿Cómo se llama tu negocio?
            <input name="nombre" required maxLength={120} defaultValue={defaultName} placeholder="Bar La Plaza" className={ui.input} autoFocus />
          </label>

          <fieldset>
            <legend className="mb-1 text-sm font-semibold">Puestos de tu equipo</legend>
            <p className="mb-3 text-[13px] text-ink-muted">Cámbialos a tu gusto. Podrás editarlos después en Ajustes.</p>
            <div className="flex flex-col gap-2">
              {roles.map((r, i) => {
                const color = template.roles[i]?.color ?? (i + 6) % 10;
                return (
                  <div key={i} className="flex items-center gap-2">
                    <span className="h-11 w-3 flex-none rounded-full" style={{ backgroundColor: roleStyle(color).backgroundColor, boxShadow: `inset 0 0 0 1px ${roleStyle(color).color}40` }} />
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
                );
              })}
            </div>
            <button type="button" onClick={() => setRoles((l) => [...l, ""])} className="mt-3 min-h-11 text-sm font-semibold text-accent hover:underline">
              + Añadir otro puesto
            </button>
          </fieldset>

          <div>
            <div className="mb-2 text-sm font-semibold">Franjas</div>
            <div className="flex flex-wrap gap-2">
              {template.shifts.map((s) => (
                <span key={s.code} className="rounded-lg border border-line bg-ground px-3 py-1.5 text-[13px]">
                  <strong className="font-semibold">{s.label}</strong> <span className="tabular-nums text-ink-muted">{s.start}–{s.end}</span>
                </span>
              ))}
            </div>
            <p className="mt-2 text-[13px] text-ink-muted">Podrás renombrarlas, cambiar horarios o añadir más en Necesidades.</p>
          </div>

          {error && (
            <p className={ui.error} role="alert">
              {error}
            </p>
          )}
          <button type="submit" disabled={pending} className={`${ui.btn} ${ui.primary} h-12 text-base`}>
            {pending ? "Preparando tu negocio…" : "Crear mi negocio"}
          </button>
        </div>
      )}
    </form>
  );
}
