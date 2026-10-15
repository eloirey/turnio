"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@/components/nav";
import { addDays, isoWeekNumber, mondayOf, todayInMadrid, weekRangeLabel } from "@/lib/dates";

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const HEAD = ["L", "M", "X", "J", "V", "S", "D"];

interface Props {
  /** Lunes de la semana que se está viendo. */
  monday: string;
  /** Página a la que se va: se le añade ?semana=…&dia=… */
  base: string;
}

/**
 * El título de la semana es también un botón: abre un calendario para saltar
 * a cualquier semana o día sin ir de una en una.
 */
export function WeekPicker({ monday, base }: Props) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => monday.slice(0, 7)); // aaaa-mm a la vista
  const [today, setToday] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  function toggle() {
    if (!open) {
      setMonth(monday.slice(0, 7));
      setToday(todayInMadrid());
    }
    setOpen((o) => !o);
  }

  function go(day: string, withDay = true) {
    setOpen(false);
    const href = `${base}?semana=${mondayOf(day)}${withDay ? `&dia=${day}` : ""}`;
    if (navigate) navigate(href);
    else router.push(href);
  }

  function shiftMonth(delta: number) {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    setMonth(d.toISOString().slice(0, 7));
  }

  // Semanas (de lunes a domingo) que tocan este mes.
  const first = `${month}-01`;
  const [y, m] = month.split("-").map(Number);
  const weeks: string[][] = [];
  for (let start = mondayOf(first); start.slice(0, 7) <= month || weeks.length === 0; start = addDays(start, 7)) {
    if (addDays(start, 6).slice(0, 7) < month) continue;
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(start, i)));
    if (weeks.length > 6) break;
  }

  return (
    <div ref={ref} className="relative min-w-0">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Elegir otra semana o día"
        className="group flex min-w-0 items-center gap-1.5 rounded-xl px-1.5 py-0.5 text-left hover:bg-surface"
      >
        <h1 className="truncate font-display text-[28px] font-bold leading-tight tracking-tight sm:text-[34px]">{weekRangeLabel(monday)}</h1>
        <svg aria-hidden viewBox="0 0 20 20" className={`h-5 w-5 flex-none text-ink-muted transition group-hover:text-ink ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 8l5 5 5-5" />
        </svg>
        <span className="sr-only">Elegir otra semana o día</span>
      </button>

      {open && (
        <div role="dialog" aria-label="Elegir semana o día" className="absolute left-0 top-full z-40 mt-2 w-[min(340px,calc(100vw-32px))] rounded-2xl border border-line bg-surface p-4 shadow-[0_24px_60px_-20px_rgba(27,27,26,0.45)] print:hidden">
          <div className="mb-3 flex items-center justify-between">
            <button type="button" onClick={() => shiftMonth(-1)} aria-label="Mes anterior" className="flex h-9 w-9 items-center justify-center rounded-lg text-lg hover:bg-ground">
              ‹
            </button>
            <span className="font-display text-[17px] font-bold capitalize">
              {MONTHS[m - 1]} {y}
            </span>
            <button type="button" onClick={() => shiftMonth(1)} aria-label="Mes siguiente" className="flex h-9 w-9 items-center justify-center rounded-lg text-lg hover:bg-ground">
              ›
            </button>
          </div>
          <div className="grid grid-cols-[34px_repeat(7,1fr)] gap-y-1 text-center text-[13px]">
            <span className="text-[11px] font-semibold text-ink-muted" title="Número de semana">
              Sem
            </span>
            {HEAD.map((d) => (
              <span key={d} className="font-semibold text-ink-muted">
                {d}
              </span>
            ))}
            {weeks.map((days) => {
              const isSelected = days[0] === monday;
              return (
                <div key={days[0]} className={`group/w col-span-8 grid grid-cols-subgrid rounded-lg ${isSelected ? "bg-accent-soft" : "hover:bg-ground"}`}>
                  <button type="button" onClick={() => go(days[0], false)} className="h-9 text-[11px] font-semibold text-ink-muted hover:text-ink" aria-label={`Semana ${isoWeekNumber(days[0])}: ${weekRangeLabel(days[0])}`}>
                    {isoWeekNumber(days[0])}
                  </button>
                  {days.map((d) => {
                    const other = d.slice(0, 7) !== month;
                    const isToday = d === today;
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => go(d)}
                        aria-label={d}
                        className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full tabular-nums hover:bg-ink hover:text-white ${other ? "text-ink-muted/60" : ""} ${isToday ? "font-bold text-accent ring-2 ring-accent" : ""}`}
                      >
                        {Number(d.slice(8))}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
            {[
              ["Esta semana", 0],
              ["La que viene", 7],
              ["La pasada", -7],
            ].map(([label, delta]) => (
              <button
                key={label}
                type="button"
                onClick={() => go(addDays(mondayOf(today || todayInMadrid()), delta as number), false)}
                className="min-h-9 rounded-full border border-line-strong px-3 text-[13px] font-semibold hover:border-ink"
              >
                {label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[12px] text-ink-muted">Toca un día para ir a su semana, o el número de la izquierda para la semana entera.</p>
        </div>
      )}
    </div>
  );
}
