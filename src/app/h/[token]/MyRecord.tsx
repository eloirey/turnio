"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ui } from "@/components/ui";
import { DAY_SHORT } from "@/lib/dates";
import { clockDetailTable, monthOption } from "@/lib/export-clock";
import { saveBlob, tableCsv, tablesToXlsx } from "@/lib/export-table";
import { formatHours, madridTime, placeText, recordHours } from "@/lib/fichajes";
import { loadMyClock, type MyClockResult } from "./actions";

/** Cuántos días se ven antes de «Ver todos». */
const PREVIEW_DAYS = 4;

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

/**
 * «Mi registro de jornada»: lo que ha fichado en el mes (con flechas para
 * cambiar de mes), el total y la descarga. Se carga al llegar a la tarjeta.
 */
export function MyRecord({ token, today }: { token: string; today: string }) {
  const current = today.slice(0, 7);
  const oldest = shiftMonth(current, -11);
  const [month, setMonth] = useState(current);
  const [data, setData] = useState<MyClockResult | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [visible, setVisible] = useState(false);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLElement>(null);

  // Solo se pide al servidor cuando la tarjeta está a la vista.
  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setVisible(true), { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    start(async () => {
      setData(await loadMyClock(token, month));
      setShowAll(false);
    });
  }, [visible, month, token]);

  const ok = data?.ok && data.month === month ? data : null;
  const now = ok ? new Date(ok.now) : new Date();
  const days = ok ? [...ok.rows].reverse() : []; // lo más reciente arriba
  const total = days.reduce((a, r) => a + r.records.reduce((b, x) => b + recordHours(x, now), 0), 0);
  const shown = showAll ? days : days.slice(0, PREVIEW_DAYS);

  async function download(format: "xlsx" | "csv") {
    if (!ok) return;
    const table = clockDetailTable(ok.rows, ok.month, ok.localName, now);
    const file = `mi-registro-${ok.month}`;
    if (format === "csv") saveBlob(new Blob([tableCsv(table)], { type: "text/csv;charset=utf-8" }), `${file}.csv`);
    else saveBlob(await tablesToXlsx([table]), `${file}.xlsx`);
  }

  return (
    <section ref={ref} aria-label="Mi registro de jornada" className={`${ui.card} p-5`}>
      <h2 className={ui.h2}>Mi registro de jornada</h2>
      <p className="mt-0.5 text-sm text-ink-soft">Lo que has fichado cada día. Es tuyo: puedes descargarlo cuando quieras.</p>

      {/* Mes: flechas grandes, fáciles en el móvil */}
      <div className="mt-4 flex items-center justify-between rounded-xl bg-ground p-1">
        <button
          type="button"
          onClick={() => setMonth(shiftMonth(month, -1))}
          disabled={month <= oldest}
          aria-label="Mes anterior"
          className="flex h-10 w-10 items-center justify-center rounded-lg text-lg text-ink-soft transition hover:bg-surface hover:text-ink disabled:opacity-30"
        >
          ‹
        </button>
        <span className="text-[15px] font-semibold" aria-live="polite">
          {monthOption(month)}
        </span>
        <button
          type="button"
          onClick={() => setMonth(shiftMonth(month, 1))}
          disabled={month >= current}
          aria-label="Mes siguiente"
          className="flex h-10 w-10 items-center justify-center rounded-lg text-lg text-ink-soft transition hover:bg-surface hover:text-ink disabled:opacity-30"
        >
          ›
        </button>
      </div>

      {data && !data.ok && <p className={`${ui.error} mt-4`}>{data.error}</p>}

      {!ok && !(data && !data.ok) && (
        <div className="mt-4 flex flex-col gap-2" aria-busy="true">
          <div className="h-12 animate-pulse rounded-xl bg-ground" />
          <div className="h-24 animate-pulse rounded-xl bg-ground" />
        </div>
      )}

      {ok && (
        <div className={`transition-opacity ${pending ? "opacity-50" : ""}`}>
          <div className="mt-4 flex items-end justify-between gap-3">
            <div>
              <div className="font-display text-[32px] font-bold leading-none tabular-nums">{formatHours(total)}</div>
              <div className="mt-1 text-[13px] text-ink-muted">
                {days.length === 0 ? "Sin fichajes" : `${days.length} ${days.length === 1 ? "día" : "días"} trabajados`}
                {month === current && " · hasta hoy"}
              </div>
            </div>
          </div>

          {days.length > 0 && (
            <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
              {shown.map((r) => {
                const d = new Date(`${r.date}T12:00:00Z`);
                const hours = r.records.reduce((a, x) => a + recordHours(x, now), 0);
                return (
                  <li key={r.date} className="flex items-start gap-3 px-3 py-2.5 text-sm">
                    <span className="w-14 flex-none text-ink-muted">
                      {DAY_SHORT[(d.getUTCDay() + 6) % 7]} <b className="font-semibold text-ink">{Number(r.date.slice(8))}</b>
                    </span>
                    <span className="min-w-0 flex-1">
                      {r.records.map((x) => (
                        <span key={x.id} className="block tabular-nums">
                          {madridTime(x.start)}–{x.end ? madridTime(x.end) : x.missingEnd ? <span className="text-danger-ink">sin salida</span> : "ahora"}
                          {x.edited && <span className="ml-1.5 text-xs text-ink-muted">· corregido</span>}
                          {(x.placeIn === "fuera" || x.placeOut === "fuera") && (
                            <span className="ml-1.5 text-xs text-danger-ink">· {placeText("fuera", x.placeIn === "fuera" ? x.distIn : x.distOut).toLowerCase()}</span>
                          )}
                          {x.placeIn === "teletrabajo" && <span className="ml-1.5 text-xs text-ink-muted">· 🏠</span>}
                        </span>
                      ))}
                    </span>
                    <span className="flex-none font-semibold tabular-nums">{formatHours(hours)}</span>
                  </li>
                );
              })}
            </ul>
          )}
          {days.length > PREVIEW_DAYS && (
            <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-2 w-full rounded-lg py-2 text-sm font-semibold text-accent hover:bg-accent-soft">
              {showAll ? "Ver menos" : `Ver los ${days.length} días`}
            </button>
          )}

          {days.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => download("xlsx")} className={`${ui.btnSm} ${ui.secondary}`}>
                ↓ Excel
              </button>
              <button type="button" onClick={() => download("csv")} className={`${ui.btnSm} ${ui.secondary}`}>
                ↓ CSV
              </button>
            </div>
          )}
          {days.some((r) => r.records.some((x) => x.edited)) && (
            <p className="mt-3 text-[12px] leading-relaxed text-ink-muted">«Corregido» quiere decir que tu encargado ajustó ese fichaje. En el Excel tienes el motivo.</p>
          )}
        </div>
      )}
    </section>
  );
}
