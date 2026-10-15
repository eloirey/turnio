"use client";

import { useState, useTransition } from "react";
import { shiftTimes } from "@/lib/schedule/rules";
import { ui } from "@/components/ui";
import { DAY_LONG } from "@/lib/dates";
import { madridDate, madridTime, type ClockChange, placeText } from "@/lib/fichajes";
import type { BoardPerson, Cell, ClockActions } from "./FichajesBoard";

/** Un tramo en el editor (lo que se ve y se puede cambiar). */
export interface Row {
  id?: string;
  start: string;
  end: string;
  /** Tramo abierto (sigue trabajando) u olvidado. */
  open: boolean;
  missingEnd: boolean;
  deleted: boolean;
  original?: { start: string; end: string };
  /** Dónde fichó la entrada y la salida (si el local lo comprueba). */
  where?: string;
}

export const REASONS = ["Olvidó fichar la salida", "Olvidó fichar la entrada", "Error al fichar", "Fichó en papel", "Cambio de turno"];

export function DayEditor(props: {
  person: BoardPerson;
  cell: Cell;
  monday: string;
  changes: ClockChange[];
  actions: ClockActions;
  isDemo: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const { person, cell: c, monday, changes, actions, onClose, onSaved } = props;
  const dayIndex = Math.round((Date.parse(c.date) - Date.parse(monday)) / 86_400_000);
  const [rows, setRows] = useState<Row[]>(() =>
    c.records.map((r) => {
      const start = madridTime(r.start);
      const end = r.end ? madridTime(r.end) : "";
      const where = [r.placeIn ? `Entrada: ${placeText(r.placeIn, r.distIn).toLowerCase()}` : "", r.placeOut ? `Salida: ${placeText(r.placeOut, r.distOut).toLowerCase()}` : ""]
        .filter(Boolean)
        .join(" · ");
      return { id: r.id, start, end, open: !r.end && !r.missingEnd, missingEnd: r.missingEnd, deleted: false, original: { start, end }, where };
    }),
  );
  const [reason, setReason] = useState(c.kind === "forgot" ? REASONS[0] : "");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const changed = rows.filter((r) => (r.id ? r.deleted || r.start !== r.original?.start || r.end !== r.original?.end : !r.deleted));

  function update(i: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((rs) => [...rs, { start: c.shift?.start ?? "09:00", end: c.shift?.end ?? "17:00", open: false, missingEnd: false, deleted: false }]);
  }

  function save() {
    setError("");
    if (!changed.length) return onClose();
    if (reason.trim().length < 2) return setError("Indica el motivo del cambio. Queda guardado en el historial.");
    start(async () => {
      for (const r of changed) {
        const res = r.deleted
          ? await actions.deleteClock(r.id!, reason)
          : await actions.saveClock({ id: r.id, employeeId: person.id, date: c.date, start: r.start, end: r.end || null, reason });
        if (!res.ok) return setError(res.error);
      }
      onSaved(changed.length === 1 ? "Fichaje corregido. Queda en el historial." : `${changed.length} cambios guardados. Quedan en el historial.`);
    });
  }

  const nextDay = (r: Row) => r.end && r.end <= r.start;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div
        role="dialog"
        aria-label={`Fichajes de ${person.name}`}
        className="fixed inset-x-0 bottom-0 z-50 max-h-[92vh] overflow-y-auto rounded-t-2xl bg-surface p-5 shadow-xl sm:inset-x-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:w-[520px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className={ui.h2}>{person.name}</h2>
            <p className="text-sm text-ink-muted">
              {DAY_LONG[dayIndex]} {Number(c.date.slice(8))} · {c.shift ? `previsto ${c.shift.label} ${shiftTimes(c.shift)}` : "sin turno previsto"}
            </p>
          </div>
          <button aria-label="Cerrar" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-lg text-ink-muted hover:bg-ground">
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {rows.length === 0 && <p className="rounded-xl bg-ground px-4 py-3 text-sm text-ink-soft">No fichó este día.</p>}
          {rows.map((r, i) =>
            r.deleted ? (
              <div key={i} className="flex items-center justify-between rounded-xl border border-dashed border-line-strong px-3 py-2 text-sm text-ink-muted">
                <span className="line-through">
                  {r.original?.start}–{r.original?.end || "…"}
                </span>
                <button onClick={() => update(i, { deleted: false })} className="font-semibold text-accent">
                  Recuperar
                </button>
              </div>
            ) : (
              <div key={i} className={`grid grid-cols-[1fr_1fr_44px] items-end gap-2 rounded-xl border p-3 ${r.missingEnd && !r.end ? "border-danger/40 bg-danger-soft/40" : "border-line"}`}>
                <label className="flex flex-col gap-1 text-xs font-semibold text-ink-muted">
                  Entrada
                  <input type="time" value={r.start} onChange={(e) => update(i, { start: e.target.value })} className={ui.input} />
                </label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-ink-muted">
                  <span>
                    Salida {nextDay(r) && <span className="font-normal">(día siguiente)</span>}
                    {!r.end && <span className={`font-normal ${r.missingEnd ? "text-danger-ink" : ""}`}>{r.missingEnd ? " · sin fichar" : r.open ? " · sigue dentro" : ""}</span>}
                  </span>
                  <input type="time" value={r.end} onChange={(e) => update(i, { end: e.target.value })} className={ui.input} />
                </label>
                <button
                  onClick={() => (r.id ? update(i, { deleted: true }) : setRows((rs) => rs.filter((_, k) => k !== i)))}
                  aria-label="Quitar tramo"
                  className="flex h-11 w-11 items-center justify-center rounded-lg text-ink-muted hover:bg-danger-soft hover:text-danger-ink"
                >
                  ✕
                </button>
                {r.where && (
                  <p className={`col-span-3 text-[12px] ${/fuera/.test(r.where) ? "font-semibold text-danger-ink" : "text-ink-muted"}`}>📍 {r.where}</p>
                )}
              </div>
            ),
          )}
          <button onClick={addRow} className="min-h-11 self-start rounded-lg px-1 text-sm font-semibold text-accent hover:underline">
            + Añadir tramo
          </button>
        </div>

        {changed.length > 0 && (
          <div className="mt-4 rounded-xl bg-ground p-4">
            <label className={ui.label}>
              Motivo del cambio
              <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="Por qué lo corriges" className={ui.input} />
            </label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {REASONS.map((x) => (
                <button key={x} type="button" onClick={() => setReason(x)} className={`rounded-full border px-3 py-1 text-[13px] ${reason === x ? "border-ink bg-surface font-semibold" : "border-line-strong text-ink-soft hover:border-ink"}`}>
                  {x}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <p className={`${ui.error} mt-3`} role="alert">
            {error}
          </p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className={`${ui.btnSm} ${ui.secondary}`}>
            Cancelar
          </button>
          <button onClick={save} disabled={pending || !changed.length} className={`${ui.btnSm} ${ui.primary}`}>
            {pending ? "Guardando…" : changed.length ? "Guardar cambios" : "Sin cambios"}
          </button>
        </div>

        {changes.length > 0 && (
          <div className="mt-5 border-t border-[#EEEBE3] pt-4">
            <h3 className="mb-2 text-sm font-semibold">Historial de cambios</h3>
            <ul className="flex flex-col gap-2 text-[13px] text-ink-soft">
              {changes.map((ch, i) => (
                <li key={i}>
                  <span className="font-semibold text-ink">{ch.action === "crear" ? "Añadido" : ch.action === "borrar" ? "Borrado" : "Corregido"}</span>{" "}
                  {ch.before && `${madridTime(ch.before.entrada)}–${ch.before.salida ? madridTime(ch.before.salida) : "sin salida"}`}
                  {ch.before && ch.after && " → "}
                  {ch.after && `${madridTime(ch.after.entrada)}–${ch.after.salida ? madridTime(ch.after.salida) : "sin salida"}`} · «{ch.reason}»
                  <span className="text-ink-muted"> · {madridDate(ch.at).split("-").reverse().join("/")} {madridTime(ch.at)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {props.isDemo && <p className="mt-4 text-[13px] text-ink-muted">En la demo los cambios no se guardan al salir.</p>}
      </div>
    </>
  );
}

// ---------- Exportar ----------
