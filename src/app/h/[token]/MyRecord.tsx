"use client";

import { useEffect, useState, useTransition } from "react";
import { ui } from "@/components/ui";
import { DAY_SHORT } from "@/lib/dates";
import { clockDetailTable, monthOption } from "@/lib/export-clock";
import { saveBlob, tableCsv, tablesToXlsx } from "@/lib/export-table";
import { formatHours, madridTime, placeText, recordHours } from "@/lib/fichajes";
import { loadMyClock, type MyClockResult } from "./actions";

/** «Mi registro»: lo que ha fichado cada día del mes, y descargarlo. */
export function MyRecord({ token, today }: { token: string; today: string }) {
  const months = Array.from({ length: 12 }, (_, k) => {
    const [y, m] = today.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1 - k, 1)).toISOString().slice(0, 7);
  });
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(months[0]);
  const [data, setData] = useState<MyClockResult | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!open) return;
    start(async () => setData(await loadMyClock(token, month)));
  }, [open, month, token]);

  const ok = data?.ok ? data : null;
  const now = ok ? new Date(ok.now) : new Date();
  const total = ok ? ok.rows.reduce((a, r) => a + r.records.reduce((b, x) => b + recordHours(x, now), 0), 0) : 0;

  async function download(format: "xlsx" | "csv") {
    if (!ok) return;
    const table = clockDetailTable(ok.rows, ok.month, ok.localName, now);
    const file = `mi-registro-${ok.month}`;
    if (format === "csv") saveBlob(new Blob([tableCsv(table)], { type: "text/csv;charset=utf-8" }), `${file}.csv`);
    else saveBlob(await tablesToXlsx([table]), `${file}.xlsx`);
  }

  return (
    <section aria-label="Mi registro de jornada" className={`${ui.card} p-5`}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 text-left">
        <span>
          <span className={`${ui.h2} block`}>Mi registro de jornada</span>
          <span className="text-sm text-ink-soft">Lo que has fichado cada día. Puedes descargarlo cuando quieras.</span>
        </span>
        <span aria-hidden className={`text-xl text-ink-muted transition ${open ? "rotate-180" : ""}`}>
          ⌄
        </span>
      </button>

      {open && (
        <div className="mt-4">
          <select value={month} onChange={(e) => setMonth(e.target.value)} className={`${ui.input} w-full`} aria-label="Mes">
            {months.map((m) => (
              <option key={m} value={m}>
                {monthOption(m)}
              </option>
            ))}
          </select>

          {pending && !ok && <p className="mt-4 text-sm text-ink-muted">Cargando…</p>}
          {data && !data.ok && <p className={`${ui.error} mt-4`}>{data.error}</p>}
          {ok && (
            <>
              <div className="mt-4 flex items-baseline justify-between">
                <span className="text-sm text-ink-soft">Total del mes</span>
                <span className="font-display text-2xl font-bold tabular-nums">{formatHours(total)}</span>
              </div>
              {ok.rows.length === 0 ? (
                <p className="mt-3 text-sm text-ink-muted">No hay fichajes este mes.</p>
              ) : (
                <ul className="mt-3 divide-y divide-line rounded-xl border border-line">
                  {ok.rows.map((r) => {
                    const d = new Date(`${r.date}T12:00:00Z`);
                    const dayName = DAY_SHORT[(d.getUTCDay() + 6) % 7];
                    const hours = r.records.reduce((a, x) => a + recordHours(x, now), 0);
                    return (
                      <li key={r.date} className="flex items-start gap-3 px-3 py-2.5 text-sm">
                        <span className="w-12 flex-none text-ink-muted">
                          {dayName} {Number(r.date.slice(8))}
                        </span>
                        <span className="min-w-0 flex-1">
                          {r.records.map((x) => (
                            <span key={x.id} className="block tabular-nums">
                              {madridTime(x.start)}–{x.end ? madridTime(x.end) : x.missingEnd ? <span className="text-danger-ink">sin salida</span> : "…"}
                              {x.edited && <span className="ml-1.5 text-xs text-ink-muted">· corregido por tu encargado</span>}
                              {(x.placeIn === "fuera" || x.placeOut === "fuera") && <span className="ml-1.5 text-xs text-danger-ink">· {placeText("fuera", x.placeIn === "fuera" ? x.distIn : x.distOut)}</span>}
                            </span>
                          ))}
                        </span>
                        <span className="flex-none font-semibold tabular-nums">{formatHours(hours)}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => download("xlsx")} disabled={!ok.rows.length} className={`${ui.btnSm} ${ui.secondary}`}>
                  Descargar Excel
                </button>
                <button type="button" onClick={() => download("csv")} disabled={!ok.rows.length} className={`${ui.btnSm} ${ui.secondary}`}>
                  Descargar CSV
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
