"use client";

import { useEffect, useRef, useState } from "react";
import { ABSENCE_LABELS, type AbsenceReason } from "@/lib/data/mappers";
import { DAY_LONG, dayOfMonth } from "@/lib/dates";
import { formatHours, madridTime, type ClockRecord, type DayStatus } from "@/lib/fichajes";
import { shiftTimes } from "@/lib/schedule/rules";
import { activeSlots, FREE, type Code, type ShiftCatalog } from "@/lib/schedule/types";
import type { CuadranteEmployee } from "./Cuadrante";

export interface Selection {
  id: string;
  day: number;
  rect: { top: number; bottom: number; left: number; width: number };
}

export function CellEditor(props: {
  sel: Selection;
  employee: CuadranteEmployee;
  current: Code;
  absent: AbsenceReason | null;
  monday: string;
  shifts: ShiftCatalog;
  clock: (DayStatus & { records: ClockRecord[] }) | null;
  onPick: (code: Code) => void;
  onClose: () => void;
}) {
  const { sel, employee, current, absent, monday, shifts, clock, onPick, onClose } = props;
  const options = [...activeSlots(shifts), ...(current !== FREE && !shifts[current]?.active ? [current] : []), FREE];
  const firstRef = useRef<HTMLButtonElement>(null);
  // El editor solo se abre tras un clic (ya en el navegador), así que window existe.
  const [mobile] = useState(() => window.innerWidth < 640);

  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  // En escritorio, el editor aparece bajo la casilla (o encima, si no cabe).
  const W = options.length > 4 ? 340 : 296;
  const H = 110 + Math.ceil(options.length / 2) * 68 + (absent ? 44 : 0) + (clock?.records.length ? 52 : 0);
  const style = mobile
    ? undefined
    : (() => {
        const below = sel.rect.bottom + 8 + H < window.innerHeight;
        const top = below ? sel.rect.bottom + 8 : Math.max(8, sel.rect.top - H - 8);
        const left = Math.min(Math.max(8, sel.rect.left + sel.rect.width / 2 - W / 2), window.innerWidth - W - 8);
        return { top, left, width: W };
      })();

  return (
    <>
      <div className={`fixed inset-0 z-40 ${mobile ? "bg-black/30" : ""}`} onClick={onClose} />
      <div
        role="dialog"
        aria-label={`Cambiar turno de ${employee.name}`}
        style={style}
        className={`fixed z-50 border border-line bg-surface p-4 shadow-xl ${mobile ? "inset-x-0 bottom-0 rounded-t-2xl pb-6" : "rounded-2xl"}`}
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <div className="text-[15px] font-semibold">{employee.name}</div>
            <div className="text-[13px] text-ink-muted">
              {DAY_LONG[sel.day]} {dayOfMonth(monday, sel.day)}
            </div>
          </div>
          <button aria-label="Cerrar" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted hover:bg-ground">
            ✕
          </button>
        </div>
        {absent && (
          <p className="mb-3 rounded-lg bg-pending-soft px-3 py-2 text-[13px] text-pending-ink">
            {employee.name} está de {ABSENCE_LABELS[absent].toLowerCase()} este día.
          </p>
        )}
        {clock && clock.records.length > 0 && (
          <div className="mb-3 rounded-lg bg-ground px-3 py-2 text-[13px]">
            <span className="font-semibold">Fichó:</span>{" "}
            {clock.records.map((r) => `${madridTime(r.start)}–${r.end ? madridTime(r.end) : r.missingEnd ? "sin salida" : "ahora"}`).join(", ")}
            <span className="text-ink-muted"> · {formatHours(clock.worked)}</span>
          </div>
        )}
        <div className="grid max-h-[60vh] grid-cols-2 gap-2 overflow-y-auto">
          {options.map((code, i) => {
            const def = shifts[code];
            const available = code === FREE || (Boolean(employee.availability[code]?.[sel.day]) && !absent);
            const isCurrent = current === code;
            return (
              <button
                key={code}
                ref={i === 0 ? firstRef : undefined}
                onClick={() => onPick(code)}
                className={`flex min-h-[60px] min-w-0 flex-col gap-0.5 rounded-xl px-3 py-2.5 text-left ${isCurrent ? "border-2 border-ink bg-ground" : "border border-line-strong hover:border-ink"}`}
              >
                <span className="truncate text-[15px] font-semibold">{code === FREE ? "Libre" : (def?.label ?? "Franja borrada")}</span>
                <small className={`text-xs ${available ? "text-ink-muted" : "text-danger-ink"}`}>
                  {code === FREE ? "No trabaja" : def ? `${shiftTimes(def)}${available ? "" : " · no disponible"}` : ""}
                </small>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
