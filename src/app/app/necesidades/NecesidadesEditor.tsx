"use client";

import { useState, useTransition } from "react";
import { ui } from "@/components/ui";
import { DAY_SHORT } from "@/lib/dates";
import { ROLES, ROLE_LABELS, ROLE_STYLES } from "@/lib/roles";
import { SLOTS, type Demand, type Rules, type ShiftCatalog, type Slot } from "@/lib/schedule/types";
import { saveNecesidades } from "./actions";

interface Props {
  initialDemand: Demand;
  initialRules: Rules;
  initialShifts: ShiftCatalog;
}

export function NecesidadesEditor({ initialDemand, initialRules, initialShifts }: Props) {
  const [demand, setDemand] = useState<Demand>(initialDemand);
  const [rules, setRules] = useState<Rules>(initialRules);
  const [shifts, setShifts] = useState<ShiftCatalog>(initialShifts);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function touch() {
    setDirty(true);
    setSaved(false);
  }

  function setCount(day: number, slot: Slot, role: string, value: number) {
    const v = Math.max(0, Math.min(50, value));
    setDemand((d) => d.map((dd, i) => (i === day ? { ...dd, [slot]: { ...(dd[slot] ?? {}), [role]: v } } : dd)));
    touch();
  }

  function setShift(slot: Slot, key: "start" | "end" | "hours", value: string) {
    setShifts((s) => ({ ...s, [slot]: { ...s[slot], [key]: key === "hours" ? Number(value) : value } }));
    touch();
  }

  function save() {
    setError("");
    startTransition(async () => {
      const res = await saveNecesidades({
        demand,
        rules,
        shifts: {
          M: { start: shifts.M.start, end: shifts.M.end, hours: shifts.M.hours },
          T: { start: shifts.T.start, end: shifts.T.end, hours: shifts.T.hours },
          N: { start: shifts.N.start, end: shifts.N.end, hours: shifts.N.hours },
        },
      });
      if (!res.ok) return setError(res.error ?? "No se ha podido guardar.");
      setDirty(false);
      setSaved(true);
    });
  }

  const perWeek = demand.reduce(
    (acc, d) => acc + SLOTS.reduce((a, s) => a + Object.values(d[s] ?? {}).reduce((x, y) => x + y, 0), 0),
    0,
  );

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className={ui.h1}>Necesidades</h1>
          <p className="mt-1.5 text-[15px] text-ink-soft">
            Cuánta gente de cada puesto hace falta en cada franja. Total: <strong>{perWeek} turnos</strong> por semana.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saved && <span className="text-sm font-semibold text-accent">Guardado ✓</span>}
          {dirty && <span className="text-sm text-pending-ink">Cambios sin guardar</span>}
          <button onClick={save} disabled={pending || !dirty} className={`${ui.btn} ${ui.primary}`}>
            {pending ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
      {error && <p className={`${ui.error} mb-5`} role="alert">{error}</p>}

      <div className="flex flex-col gap-6">
        <section className={`${ui.card} p-5`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-separate border-spacing-1.5 text-sm">
              <thead>
                <tr className="text-left text-[13px] text-ink-muted">
                  <th className="w-40 font-semibold">Franja · puesto</th>
                  {DAY_SHORT.map((d) => (
                    <th key={d} className="text-center font-semibold">
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SLOTS.map((slot) =>
                  ROLES.map((role, ri) => (
                    <tr key={`${slot}-${role}`}>
                      <th scope="row" className={`text-left font-normal ${ri === 0 ? "pt-3" : ""}`}>
                        {ri === 0 && <div className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-ink-muted">{shifts[slot].label}</div>}
                        <span className={`rounded-md px-2 py-0.5 text-[13px] font-semibold ${ROLE_STYLES[role]}`}>{ROLE_LABELS[role]}</span>
                      </th>
                      {demand.map((d, day) => {
                        const v = d[slot]?.[role] ?? 0;
                        return (
                          <td key={day} className={ri === 0 ? "pt-3" : ""}>
                            <div className={`flex h-11 items-center justify-between rounded-lg border ${v ? "border-ink/30 bg-ground" : "border-line"}`}>
                              <button
                                type="button"
                                aria-label={`Menos ${ROLE_LABELS[role]} ${shifts[slot].label} ${DAY_SHORT[day]}`}
                                onClick={() => setCount(day, slot, role, v - 1)}
                                disabled={v === 0}
                                className="h-full w-8 text-lg text-ink-muted disabled:opacity-30"
                              >
                                −
                              </button>
                              <span className={`font-semibold ${v ? "" : "text-ink-muted"}`}>{v}</span>
                              <button
                                type="button"
                                aria-label={`Más ${ROLE_LABELS[role]} ${shifts[slot].label} ${DAY_SHORT[day]}`}
                                onClick={() => setCount(day, slot, role, v + 1)}
                                className="h-full w-8 text-lg text-ink-muted"
                              >
                                +
                              </button>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div className="flex flex-wrap gap-6">
          <section className={`${ui.card} flex-[1_1_420px] p-5`}>
            <h2 className={`${ui.h2} mb-1`}>Horario de cada franja</h2>
            <p className="mb-4 text-sm text-ink-soft">Las horas cuentan para comparar con el contrato.</p>
            <div className="flex flex-col gap-3">
              {SLOTS.map((slot) => (
                <div key={slot} className="grid grid-cols-[80px_1fr_1fr_90px] items-end gap-2">
                  <span className="pb-3 text-sm font-semibold">{shifts[slot].label}</span>
                  <label className={ui.label}>
                    <span className="text-xs text-ink-muted">Entrada</span>
                    <input type="time" value={shifts[slot].start} onChange={(e) => setShift(slot, "start", e.target.value)} className={ui.input} />
                  </label>
                  <label className={ui.label}>
                    <span className="text-xs text-ink-muted">Salida</span>
                    <input type="time" value={shifts[slot].end} onChange={(e) => setShift(slot, "end", e.target.value)} className={ui.input} />
                  </label>
                  <label className={ui.label}>
                    <span className="text-xs text-ink-muted">Horas</span>
                    <input
                      type="number"
                      min={0.5}
                      max={16}
                      step={0.5}
                      value={shifts[slot].hours}
                      onChange={(e) => setShift(slot, "hours", e.target.value)}
                      className={ui.input}
                    />
                  </label>
                </div>
              ))}
            </div>
          </section>

          <section className={`${ui.card} flex-[1_1_320px] p-5`}>
            <h2 className={`${ui.h2} mb-4`}>Reglas del equipo</h2>
            <label className="mb-4 flex items-center justify-between gap-3 text-[15px]">
              Máximo de cierres seguidos
              <select
                value={rules.maxConsecutiveNights}
                onChange={(e) => {
                  setRules((r) => ({ ...r, maxConsecutiveNights: Number(e.target.value) }));
                  touch();
                }}
                className={`${ui.input} w-24`}
              >
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-h-11 items-center gap-3 text-[15px]">
              <input
                type="checkbox"
                checked={rules.forbidNightThenMorning}
                onChange={(e) => {
                  setRules((r) => ({ ...r, forbidNightThenMorning: e.target.checked }));
                  touch();
                }}
                className="h-5 w-5 accent-accent"
              />
              No poner mañana después de un cierre
            </label>
          </section>
        </div>
      </div>
    </>
  );
}
