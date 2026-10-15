"use client";

import { useState, useTransition } from "react";
import { useConfirm, useToast } from "@/components/feedback";
import { NavLink } from "@/components/nav";
import { RoleBadge } from "@/components/RoleBadge";
import { ui } from "@/components/ui";
import { DAY_SHORT } from "@/lib/dates";
import type { NecesidadesInput } from "@/lib/forms";
import type { Role } from "@/lib/roles";
import { shiftHours, shiftTimes, spanHours } from "@/lib/schedule/rules";
import { activeSlots, MAX_SLOTS, type Demand, type ShiftCatalog } from "@/lib/schedule/types";
import { saveNecesidades, type SaveResult } from "./actions";

interface ShiftRow {
  code: string;
  label: string;
  start: string;
  end: string;
  /** Turno partido: segundo tramo (vacío si no lo es). */
  start2: string;
  end2: string;
  closing: boolean;
}

interface Props {
  initialDemand: Demand;
  initialShifts: ShiftCatalog;
  roles: Role[];
  /** La demo guarda en memoria; la app, en el servidor. */
  onSave?: (input: NecesidadesInput) => Promise<SaveResult>;
}

/** Código nuevo para una franja: corto, sin espacios y que no exista ya. */
function newCode(existing: string[]): string {
  for (let i = 1; ; i++) {
    const code = `F${i}`;
    if (!existing.includes(code)) return code;
  }
}

/** "16:00" + 4 → "20:00" (para proponer el segundo tramo). */
function addHours(hhmm: string, h: number): string {
  const [hh, mm] = hhmm.split(":").map(Number);
  return `${String((hh + h) % 24).padStart(2, "0")}:${String(mm || 0).padStart(2, "0")}`;
}

const fmtHours = (h: number) => (Number.isInteger(h) ? `${h} h` : `${h.toFixed(1).replace(".", ",")} h`);

export function NecesidadesEditor({ initialDemand, initialShifts, roles, onSave = saveNecesidades }: Props) {
  const [demand, setDemand] = useState<Demand>(initialDemand);
  const [rows, setRows] = useState<ShiftRow[]>(() =>
    activeSlots(initialShifts).map((c) => {
      const s = initialShifts[c];
      return { code: c, label: s.label, start: s.start, end: s.end, start2: s.start2 ?? "", end2: s.end2 ?? "", closing: s.closing };
    }),
  );
  const [dirty, setDirty] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  const { confirm, view: confirmView } = useConfirm();

  function touch() {
    setDirty(true);
  }

  function setCount(day: number, slot: string, role: string, value: number) {
    const v = Math.max(0, Math.min(50, value));
    setDemand((d) => d.map((dd, i) => (i === day ? { ...dd, [slot]: { ...(dd[slot] ?? {}), [role]: v } } : dd)));
    touch();
  }

  /** Copia el lunes al resto de días laborables (o a toda la semana). */
  function copyMonday(toWeekend: boolean) {
    setDemand((d) => d.map((dd, i) => (i === 0 || (i >= 5 && !toWeekend) ? dd : structuredClone(d[0]))));
    touch();
  }

  function updateRow(i: number, patch: Partial<ShiftRow>) {
    setRows((r) => r.map((row, k) => (k === i ? { ...row, ...patch } : row)));
    touch();
  }

  function moveRow(i: number, dir: -1 | 1) {
    setRows((r) => {
      const j = i + dir;
      if (j < 0 || j >= r.length) return r;
      const next = [...r];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    touch();
  }

  function addRow() {
    setRows((r) => [...r, { code: newCode(r.map((x) => x.code)), label: "", start: "10:00", end: "18:00", start2: "", end2: "", closing: false }]);
    touch();
  }

  async function removeRow(i: number) {
    const row = rows[i];
    const used = demand.some((d) => Object.values(d[row.code] ?? {}).some((n) => n > 0));
    const ok = await confirm({
      title: `¿Quitar «${row.label || "esta franja"}»?`,
      body: used
        ? "Se quitará de las necesidades y de la disponibilidad del equipo. Los cuadrantes que ya hiciste la conservan."
        : "Se quitará de la disponibilidad del equipo. Los cuadrantes que ya hiciste la conservan.",
      confirmLabel: "Quitar franja",
      danger: true,
    });
    if (!ok) return;
    setRows((r) => r.filter((_, k) => k !== i));
    setDemand((d) =>
      d.map((dd) => {
        const next = { ...dd };
        delete next[row.code];
        return next;
      }),
    );
    touch();
  }

  function save() {
    start(async () => {
      const res = await onSave({
        demand: demand as NecesidadesInput["demand"],
        shifts: rows.map((r) => ({ ...r, label: r.label.trim(), start2: r.start2 || null, end2: r.end2 || null })),
      });
      if (!res.ok) return toast.show({ message: res.error, tone: "error" });
      setDirty(false);
      toast.show("Guardado. El generador ya lo tiene en cuenta.");
    });
  }

  const perWeek = demand.reduce(
    (acc, d) => acc + rows.reduce((a, s) => a + Object.entries(d[s.code] ?? {}).reduce((x, [role, n]) => x + (roles.some((r) => r.key === role) ? n : 0), 0), 0),
    0,
  );

  if (roles.length === 0) {
    return (
      <div className={`${ui.card} p-8 text-center`}>
        <p className="text-ink-soft">Primero crea los puestos de tu equipo.</p>
        <NavLink href="/app/ajustes" className={`${ui.btn} ${ui.primary} mt-4`}>
          Ir a Ajustes
        </NavLink>
      </div>
    );
  }

  return (
    <>
      <div className="sticky top-0 z-20 -mx-4 mb-6 flex flex-wrap items-end justify-between gap-4 bg-ground/95 px-4 pb-3 pt-1 backdrop-blur sm:static sm:mx-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
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
        <section className={`${ui.card} p-4 sm:p-5`} aria-label="Personas por franja">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
            <p className="text-ink-muted">Toca + y − para cambiar cuántas personas hacen falta.</p>
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-ink-muted">Atajo:</span>
              <button onClick={() => copyMonday(false)} className="min-h-9 rounded-lg px-3 font-semibold text-accent hover:bg-accent-soft">
                Lunes → entre semana
              </button>
              <button onClick={() => copyMonday(true)} className="min-h-9 rounded-lg px-3 font-semibold text-accent hover:bg-accent-soft">
                Lunes → toda la semana
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-separate border-spacing-1.5 text-sm">
              <thead>
                <tr className="text-left text-[13px] text-ink-muted">
                  <th className="sticky left-0 z-10 w-44 bg-surface font-semibold">Franja · puesto</th>
                  {DAY_SHORT.map((d) => (
                    <th key={d} className="text-center font-semibold">
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((slot) =>
                  roles.map((role, ri) => (
                    <tr key={`${slot.code}-${role.key}`}>
                      <th scope="row" className={`sticky left-0 z-10 bg-surface text-left font-normal ${ri === 0 ? "pt-4" : ""}`}>
                        {ri === 0 && (
                          <div className="mb-1.5 truncate text-[12px] font-semibold uppercase tracking-wide text-ink-muted" title={slot.label}>
                            {slot.label || "Franja nueva"} · {shiftTimes({ start: slot.start, end: slot.end, start2: slot.start2 || null, end2: slot.end2 || null })}
                          </div>
                        )}
                        <RoleBadge role={role} />
                      </th>
                      {demand.map((d, day) => {
                        const v = d[slot.code]?.[role.key] ?? 0;
                        return (
                          <td key={day} className={ri === 0 ? "pt-4 align-bottom" : ""}>
                            <div className={`flex h-11 items-center justify-between rounded-lg border ${v ? "border-ink/25 bg-ground" : "border-line"}`}>
                              <button
                                type="button"
                                aria-label={`Menos ${role.name}, ${slot.label}, ${DAY_SHORT[day]}`}
                                onClick={() => setCount(day, slot.code, role.key, v - 1)}
                                disabled={v === 0}
                                className="h-full w-8 text-lg text-ink-muted disabled:opacity-25"
                              >
                                −
                              </button>
                              <span className={`font-semibold tabular-nums ${v ? "" : "text-ink-muted"}`}>{v}</span>
                              <button
                                type="button"
                                aria-label={`Más ${role.name}, ${slot.label}, ${DAY_SHORT[day]}`}
                                onClick={() => setCount(day, slot.code, role.key, v + 1)}
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

        <section className={`${ui.card} p-4 sm:p-5`} aria-label="Franjas">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div className="max-w-2xl">
              <h2 className={`${ui.h2} mb-1`}>Franjas y horarios</h2>
              <p className="text-sm leading-relaxed text-ink-soft">
                Llámalas como quieras: «Mañana», «Línea 12», «Partido»… Las horas se calculan solas; si la salida es antes que la entrada, termina al día
                siguiente. Marca como <strong>cierre</strong> las que acaban tarde: cuentan para la regla de cierres seguidos.
              </p>
            </div>
            <button type="button" onClick={addRow} disabled={rows.length >= MAX_SLOTS} className={`${ui.btnSm} ${ui.secondary}`}>
              + Añadir franja
            </button>
          </div>

          <div className="hidden grid-cols-[64px_minmax(140px,1fr)_120px_120px_70px_96px_44px] gap-2 px-1 pb-1 text-xs font-semibold text-ink-muted md:grid">
            <span>Orden</span>
            <span>Nombre</span>
            <span>Entrada</span>
            <span>Salida</span>
            <span className="text-right">Horas</span>
            <span className="text-center">Cierre</span>
            <span />
          </div>
          <ul className="flex flex-col gap-2">
            {rows.map((row, i) => {
              const split = Boolean(row.start2 || row.end2);
              const h = shiftHours(row.start, row.end, row.start2 || null, row.end2 || null);
              const bad = spanHours(row.start, row.end) < 0.5 || h > 16;
              return (
                <li
                  key={row.code}
                  className="grid grid-cols-[1fr_auto] gap-2 rounded-xl border border-line p-3 md:grid-cols-[64px_minmax(140px,1fr)_140px_140px_70px_96px_44px] md:items-center md:border-0 md:p-1"
                >
                  <div className="order-last flex gap-1 md:order-none">
                    <button type="button" onClick={() => moveRow(i, -1)} disabled={i === 0} aria-label={`Subir ${row.label}`} className="h-9 w-9 rounded-lg border border-line text-ink-muted disabled:opacity-30">
                      ↑
                    </button>
                    <button type="button" onClick={() => moveRow(i, 1)} disabled={i === rows.length - 1} aria-label={`Bajar ${row.label}`} className="h-9 w-9 rounded-lg border border-line text-ink-muted disabled:opacity-30">
                      ↓
                    </button>
                  </div>
                  <input
                    aria-label="Nombre de la franja"
                    value={row.label}
                    maxLength={30}
                    placeholder="Nombre (p. ej. Línea 12)"
                    onChange={(e) => updateRow(i, { label: e.target.value })}
                    className={`${ui.input} col-span-2 md:col-span-1 ${row.label.trim() ? "" : "border-pending-ink/50"}`}
                  />
                  <label className="flex items-center gap-2 text-xs text-ink-muted md:block">
                    <span className="w-14 md:hidden">Entrada</span>
                    <input type="time" aria-label={`Entrada de ${row.label}`} value={row.start} onChange={(e) => updateRow(i, { start: e.target.value })} className={`${ui.input} w-full`} />
                  </label>
                  <label className="flex items-center gap-2 text-xs text-ink-muted md:block">
                    <span className="w-14 md:hidden">Salida</span>
                    <input type="time" aria-label={`Salida de ${row.label}`} value={row.end} onChange={(e) => updateRow(i, { end: e.target.value })} className={`${ui.input} w-full`} />
                  </label>
                  <span className={`text-sm font-semibold tabular-nums md:text-right ${bad ? "text-danger-ink" : ""}`}>{fmtHours(h)}</span>
                  <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm md:justify-center">
                    <input type="checkbox" checked={row.closing} onChange={(e) => updateRow(i, { closing: e.target.checked })} className="h-5 w-5 accent-[#1F5C46]" />
                    <span className="md:sr-only">Es un cierre</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    disabled={rows.length <= 1}
                    aria-label={`Quitar ${row.label}`}
                    className="h-10 w-10 justify-self-end rounded-lg text-lg text-ink-muted hover:bg-danger-soft hover:text-danger-ink disabled:opacity-30"
                  >
                    ✕
                  </button>
                  {/* Turno partido: un segundo tramo el mismo día (p. ej. 12–16 y 20–24). */}
                  <div className="col-span-2 flex flex-wrap items-center gap-x-3 gap-y-2 md:col-span-7 md:pl-[72px]">
                    <label className="flex min-h-9 cursor-pointer items-center gap-2 text-sm text-ink-soft">
                      <input
                        type="checkbox"
                        checked={split}
                        onChange={(e) =>
                          updateRow(i, e.target.checked ? { start2: addHours(row.end, 4), end2: addHours(row.end, 8) } : { start2: "", end2: "" })
                        }
                        className="h-4 w-4 accent-[#1F5C46]"
                      />
                      Turno partido
                    </label>
                    {split && (
                      <span className="flex flex-wrap items-center gap-2 text-sm text-ink-soft">
                        y vuelve de
                        <input type="time" aria-label={`Vuelta de ${row.label}`} value={row.start2} onChange={(e) => updateRow(i, { start2: e.target.value })} className={`${ui.input} w-[130px]`} />
                        a
                        <input type="time" aria-label={`Salida final de ${row.label}`} value={row.end2} onChange={(e) => updateRow(i, { end2: e.target.value })} className={`${ui.input} w-[130px]`} />
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          {rows.length >= MAX_SLOTS && <p className="mt-3 text-sm text-ink-muted">Has llegado al máximo de {MAX_SLOTS} franjas.</p>}
        </section>
      </div>
      {toast.view}
      {confirmView}
    </>
  );
}
