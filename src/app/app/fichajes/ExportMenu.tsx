"use client";

import { useMemo, useState } from "react";
import { ExportChooser } from "@/components/ExportChooser";
import { CLOCK_MODELS, clockTable, monthOption } from "@/lib/export-clock";
import { saveBlob, tableCsv, tablesToXlsx } from "@/lib/export-table";
import { ui } from "@/components/ui";
import type { ClockActions } from "./FichajesBoard";

export function ExportMenu({ monday, today, exportClock, onError }: { monday: string; today: string; exportClock: NonNullable<ClockActions["exportClock"]>; onError: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  const months = useMemo(() => {
    const list: string[] = [];
    const [y, m] = (monday > today ? today : monday).split("-").map(Number);
    for (let k = 0; k < 12; k++) list.push(new Date(Date.UTC(y, m - 1 - k, 1)).toISOString().slice(0, 7));
    return list;
  }, [monday, today]);
  const [month, setMonth] = useState(months[0]);

  return (
    <>
      <button onClick={() => setOpen(true)} className={`${ui.btn} ${ui.secondary}`}>
        Exportar registro…
      </button>
      {open && (
        <ExportChooser
          title="Exportar el registro de jornada"
          subtitle="Guarda tu copia cada mes o mándala a tu gestoría."
          before={{
            label: "¿De qué mes?",
            content: (
              <select value={month} onChange={(e) => setMonth(e.target.value)} className={`${ui.input} w-full`} aria-label="Mes">
                {months.map((m) => (
                  <option key={m} value={m}>
                    {monthOption(m)}
                  </option>
                ))}
              </select>
            ),
          }}
          models={CLOCK_MODELS}
          storageKey="rotafy:exportar-fichajes"
          onClose={() => setOpen(false)}
          onDownload={async (model, format) => {
            try {
              const res = await exportClock(month);
              if (!res.ok) return onError(res.error);
              const table = clockTable(model, res.rows, res.month, res.localName, new Date(res.now));
              const suffix = model === "detail" ? "" : model === "summary" ? "-resumen" : "-por-dia";
              if (format === "csv") saveBlob(new Blob([tableCsv(table)], { type: "text/csv;charset=utf-8" }), `${res.fileBase}${suffix}.csv`);
              else saveBlob(await tablesToXlsx([table]), `${res.fileBase}${suffix}.xlsx`);
              setOpen(false);
            } catch {
              onError("No se ha podido crear el archivo. Inténtalo de nuevo.");
            }
          }}
        />
      )}
    </>
  );
}
