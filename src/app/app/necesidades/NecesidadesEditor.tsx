"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useToast } from "@/components/feedback";
import { RoleBadge } from "@/components/RoleBadge";
import { ui } from "@/components/ui";
import { DAY_SHORT } from "@/lib/dates";
import type { Role } from "@/lib/roles";
import { toHours } from "@/lib/schedule/rules";
import { SLOTS, type Demand, type ShiftCatalog, type Slot } from "@/lib/schedule/types";
import { saveNecesidades } from "./actions";

interface Props {
  initialDemand: Demand;
  initialShifts: ShiftCatalog;
  roles: Role[];
}

/** Horas entre dos "HH:MM" (si la salida es anterior, cruza la medianoche). */
function spanHours(start: string, end: string): number {
  let d = toHours(end) - toHours(start);
  if (d <= 0) d += 24;
  return Math.round(d * 2) / 2;
}

export function NecesidadesEditor({ initialDemand, initialShifts, roles }: Props) {
  const [demand, setDemand] = useState<Demand>(initialDemand);
  const [shifts, setShifts] = useState<ShiftCatalog>(initialShifts);
  const [dirty, setDirty] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();

  function setCount(day: number, slot: Slot, role: string, value: number) {
    const v = Math.max(0, Math.min(50, value));
    setDemand((d) => d.map((dd, i) => (i === day ? { ...dd, [slot]: { ...(dd[slot] ?? {}), [role]: v } } : dd)));
    setDirty(true);
  }

  /** Copia el lunes al resto de días laborables (o a toda la semana). */
  function copyMonday(toWeekend: boolean) {
    setDemand((d) => d.map((dd, i) => (i === 0 || (i >= 5 && !toWeekend) ? dd : structuredClone(d[0]))));
    setDirty(true);
  }

  function setShift(slot: Slot, key: "start" | "end", value: string) {
    setShifts((s) => {
      const next = { ...s[slot], [key]: value };
      // Las horas se calculan solas a partir de la entrada y la salida.
      next.hours = spanHours(next.start, next.end);
      return { ...s, [slot]: next };
    });
    setDirty(true);
  }

  function save() {
    start(async () => {
      const res = await saveNecesidades({
        demand,
        shifts: {
          M: { start: shifts.M.start, end: shifts.M.end, hours: shifts.M.hours },
          T: { start: shifts.T.start, end: shifts.T.end, hours: shifts.T.hours },
          N: { start: shifts.N.start, end: shifts.N.end, hours: shifts.N.hours },
        },
      });
      if (!res.ok) return toast.show({ message: res.error ?? "No se ha podido guardar.", tone: "error" });
      setDirty(false);
      toast.show("Necesidades guardadas. El generador ya las tiene en cuenta.");
    });
  }

  const perWeek = demand.reduce((acc, d) => acc + SLOTS.reduce((a, s) => a + Object.values(d[s] ?? {}).reduce((x, y) => x + y, 0), 0), 0);

  if (roles.length === 0) {
    return (
      <div className={`${ui.card} p-8 text-center`}>
        <p className="text-ink-soft">Primero crea los puestos de tu equipo.</p>
        <Link href="/app/ajustes" className={`${ui.btn} ${ui.primary} mt-4`}>
          Ir a Ajustes
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className={ui.h1}>Necesidades</h1>
          <p className="mt-1.5 max-w-2xl text-[15px] text-ink-soft">
            Cuánta gente de cada puesto necesitas en cada franja. Es lo que el generador intenta cubrir: <strong>{perWeek} turnos</strong> por semana.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {dirty && <span className="text-sm font-medium text-pending-ink">Cambios sin guardar</span>}
          <button onClick={save} disabled={pending || !dirty} className={`${ui.btn} ${ui.primary}`}>
            {pending ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <section className={`${ui.card} p-4 sm:p-5`}>
          <div className="mb-3 flex flex-wrap items-center justify-end gap-2 text-sm">
            <span className="text-ink-muted">Atajo:</span>
            <button onClick={() => copyMonday(false)} className="min-h-9 rounded-lg px-3 font-semibold text-accent hover:bg-accent-soft">
              Copiar el lunes a entre semana
            </button>
            <button onClick={() => copyMonday(true)} className="min-h-9 rounded-lg px-3 font-semibold text-accent hover:bg-accent-soft">
              Copiar el lunes a toda la semana
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-separate border-spacing-1.5 text-sm">
              <thead>
                <tr className="text-left text-[13px] text-ink-muted">
                  <th className="sticky left-0 z-10 w-40 bg-surface font-semibold">Franja · puesto</th>
                  {DAY_SHORT.map((d) => (
                    <th key={d} className="text-center font-semibold">
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SLOTS.map((slot) =>
                  roles.map((role, ri) => (
                    <tr key={`${slot}-${role.key}`}>
                      <th scope="row" className={`sticky left-0 z-10 bg-surface text-left font-normal ${ri === 0 ? "pt-4" : ""}`}>
                        {ri === 0 && (
                          <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-ink-muted">
                            {shifts[slot].label} · {shifts[slot].start}–{shifts[slot].end}
                          </div>
                        )}
                        <RoleBadge role={role} />
                      </th>
                      {demand.map((d, day) => {
                        const v = d[slot]?.[role.key] ?? 0;
                        return (
                          <td key={day} className={ri === 0 ? "pt-4 align-bottom" : ""}>
                            <div className={`flex h-11 items-center justify-between rounded-lg border ${v ? "border-ink/25 bg-ground" : "border-line"}`}>
                              <button
                                type="button"
                                aria-label={`Menos ${role.name}, ${shifts[slot].label}, ${DAY_SHORT[day]}`}
                                onClick={() => setCount(day, slot, role.key, v - 1)}
                                disabled={v === 0}
                                className="h-full w-8 text-lg text-ink-muted disabled:opacity-25"
                              >
                                −
                              </button>
                              <span className={`font-semibold tabular-nums ${v ? "" : "text-ink-muted"}`}>{v}</span>
                              <button
                                type="button"
                                aria-label={`Más ${role.name}, ${shifts[slot].label}, ${DAY_SHORT[day]}`}
                                onClick={() => setCount(day, slot, role.key, v + 1)}
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

        <section className={`${ui.card} max-w-2xl p-5`}>
          <h2 className={`${ui.h2} mb-1`}>Horario de cada franja</h2>
          <p className="mb-4 text-sm text-ink-soft">
            Las horas se calculan solas. Si la salida es antes que la entrada, se entiende que termina al día siguiente.
          </p>
          <div className="flex flex-col gap-3">
            {SLOTS.map((slot) => (
              <div key={slot} className="grid grid-cols-[72px_1fr_1fr_64px] items-end gap-2 sm:grid-cols-[90px_1fr_1fr_80px]">
                <span className="pb-3 text-sm font-semibold">{shifts[slot].label}</span>
                <label className={ui.label}>
                  <span className="text-xs font-normal text-ink-muted">Entrada</span>
                  <input type="time" value={shifts[slot].start} onChange={(e) => setShift(slot, "start", e.target.value)} className={ui.input} />
                </label>
                <label className={ui.label}>
                  <span className="text-xs font-normal text-ink-muted">Salida</span>
                  <input type="time" value={shifts[slot].end} onChange={(e) => setShift(slot, "end", e.target.value)} className={ui.input} />
                </label>
                <div className="pb-3 text-right text-sm font-semibold tabular-nums">{shifts[slot].hours} h</div>
              </div>
            ))}
          </div>
        </section>
      </div>
      {toast.view}
    </>
  );
}
