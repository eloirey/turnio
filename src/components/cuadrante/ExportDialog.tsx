"use client";

import { useEffect, useRef, useState } from "react";
import { ui } from "@/components/ui";
import { dayRows, EXPORT_FORMATS, exportFilename, exportTitle, gridRows, scheduleCsv, shiftRows, type ExportFormat, type ScheduleExportInput } from "@/lib/export-schedule";
import { DAY_SHORT, dayOfMonth } from "@/lib/dates";
import { PALETTE } from "@/lib/roles";

const KEY = "rotafy:formato-exportar";

/** Elige el formato y descarga el cuadrante de la semana. */
export function ExportDialog({ input, onClose, onError }: { input: ScheduleExportInput; onClose: () => void; onError: (m: string) => void }) {
  const [format, setFormat] = useState<ExportFormat>(() => {
    try {
      const saved = window.localStorage.getItem(KEY) as ExportFormat | null;
      return EXPORT_FORMATS.some((f) => f.key === saved) ? (saved as ExportFormat) : "all";
    } catch {
      return "all";
    }
  });
  const [busy, setBusy] = useState(false);
  const firstRef = useRef<HTMLInputElement>(null);

  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function download() {
    setBusy(true);
    try {
      try {
        window.localStorage.setItem(KEY, format);
      } catch {
        // sin almacenamiento: no pasa nada
      }
      if (format === "csv") {
        save(new Blob([scheduleCsv(input)], { type: "text/csv;charset=utf-8" }), exportFilename(input.localName, input.monday, "csv"));
      } else {
        const blob = await buildWorkbook(input, format);
        save(blob, exportFilename(input.localName, input.monday, "xlsx"));
      }
      onClose();
    } catch {
      onError("No se ha podido crear el archivo. Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 p-0 backdrop-blur-[2px] sm:items-center sm:p-4 print:hidden" role="dialog" aria-modal="true" aria-labelledby="export-title">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-t-3xl bg-surface p-6 shadow-2xl sm:rounded-3xl">
        <h2 id="export-title" className="font-display text-2xl font-bold">
          Exportar el cuadrante
        </h2>
        <p className="mt-1 text-sm text-ink-soft">{exportTitle(input)}</p>
        <fieldset className="mt-5 flex flex-col gap-2">
          <legend className="sr-only">Formato</legend>
          {EXPORT_FORMATS.map((f, i) => (
            <label
              key={f.key}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition ${format === f.key ? "border-2 border-ink bg-ground" : "border-line-strong hover:border-ink"}`}
            >
              <input
                ref={i === 0 ? firstRef : undefined}
                type="radio"
                name="formato"
                value={f.key}
                checked={format === f.key}
                onChange={() => setFormat(f.key)}
                className="mt-1 h-4 w-4 flex-none accent-[#1F5C46]"
              />
              <span className="min-w-0">
                <span className="flex items-center gap-2 text-[15px] font-semibold">
                  {f.title}
                  <span className="rounded bg-line px-1.5 py-0.5 text-[11px] font-semibold uppercase text-ink-soft">.{f.ext}</span>
                </span>
                <span className="block text-[13px] leading-snug text-ink-muted">{f.detail}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={`${ui.btn} ${ui.secondary}`}>
            Cancelar
          </button>
          <button type="button" onClick={download} disabled={busy} className={`${ui.btn} ${ui.primary}`}>
            {busy ? "Preparando…" : "Descargar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- Excel ----------

const argb = (hex: string) => "FF" + hex.replace("#", "").toUpperCase();
const INK = "#1B1B1A";
const MUTED = "#6B6860";
const LINE = "#E4E1D8";
const GROUND = "#F4F3EE";
const ACCENT = "#1F5C46";

export async function buildWorkbook(input: ScheduleExportInput, format: Exclude<ExportFormat, "csv">): Promise<Blob> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Rotafy";
  wb.created = new Date();
  type Sheet = ReturnType<typeof wb.addWorksheet>;

  const border = { style: "thin" as const, color: { argb: argb(LINE) } };
  const borders = { top: border, left: border, bottom: border, right: border };

  function title(ws: Sheet, cols: number, subtitle: string) {
    ws.mergeCells(1, 1, 1, cols);
    const t = ws.getCell(1, 1);
    t.value = exportTitle(input);
    t.font = { bold: true, size: 15, color: { argb: argb(INK) } };
    ws.mergeCells(2, 1, 2, cols);
    const s = ws.getCell(2, 1);
    s.value = subtitle;
    s.font = { size: 10, color: { argb: argb(MUTED) } };
    ws.getRow(1).height = 24;
  }

  function header(ws: Sheet, rowIndex: number, labels: string[]) {
    const row = ws.getRow(rowIndex);
    labels.forEach((l, i) => {
      const c = row.getCell(i + 1);
      c.value = l;
      c.font = { bold: true, color: { argb: "FFFFFFFF" } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(ACCENT) } };
      c.alignment = { vertical: "middle", horizontal: i === 0 ? "left" : "center", wrapText: true };
      c.border = borders;
    });
    row.height = 22;
  }

  function setup(ws: Sheet) {
    ws.pageSetup = { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } };
  }

  if (format === "all" || format === "grid") {
    const ws = wb.addWorksheet("Cuadrante", { views: [{ state: "frozen", xSplit: 2, ySplit: 3 }] });
    setup(ws);
    title(ws, 11, "Turno de cada persona cada día. Libre = no trabaja.");
    header(ws, 3, ["Persona", "Puesto", ...DAY_SHORT.map((d, i) => `${d} ${dayOfMonth(input.monday, i)}`), "Horas", "Contrato"]);
    ws.columns = [{ width: 22 }, { width: 16 }, ...Array.from({ length: 7 }, () => ({ width: 15 })), { width: 9 }, { width: 10 }];
    gridRows(input).forEach((r, i) => {
      const row = ws.getRow(4 + i);
      row.height = 34;
      row.getCell(1).value = r.name;
      row.getCell(1).font = { bold: true };
      row.getCell(2).value = r.role;
      row.getCell(2).font = { color: { argb: argb(MUTED) } };
      r.cells.forEach((c, d) => {
        const cell = row.getCell(3 + d);
        cell.value = c.text;
        cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
        if (c.kind === "shift") {
          const p = PALETTE[(c.roleColor ?? 7) % PALETTE.length];
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(p.bg) } };
          cell.font = { bold: true, color: { argb: argb(p.fg) } };
        } else if (c.kind === "absent") {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb("#FBEFD5") } };
          cell.font = { italic: true, color: { argb: argb("#7A4B00") } };
        } else {
          cell.font = { color: { argb: argb("#A9A59B") } };
        }
      });
      const h = row.getCell(10);
      h.value = r.hours;
      h.numFmt = "0.##";
      h.font = { bold: true, color: { argb: argb(r.hours > r.contract ? "#9A3412" : INK) } };
      const k = row.getCell(11);
      k.value = r.contract;
      k.numFmt = "0.##";
      k.font = { color: { argb: argb(MUTED) } };
      for (let c = 1; c <= 11; c++) {
        row.getCell(c).border = borders;
        if (c <= 2 || c >= 10) row.getCell(c).alignment = { vertical: "middle", horizontal: c <= 2 ? "left" : "center" };
      }
    });
  }

  if (format === "all" || format === "byDay") {
    const ws = wb.addWorksheet("Por día", { views: [{ state: "frozen", ySplit: 3 }] });
    setup(ws);
    const withNeeds = Boolean(input.demand);
    title(ws, withNeeds ? 7 : 6, "Quién trabaja en cada franja de cada día.");
    header(ws, 3, ["Día", "Franja", "Horario", "Puesto", "Personas", "Cuántas", ...(withNeeds ? ["Necesarias"] : [])]);
    ws.columns = [{ width: 10 }, { width: 18 }, { width: 13 }, { width: 16 }, { width: 48 }, { width: 9 }, ...(withNeeds ? [{ width: 11 }] : [])];
    let lastDay = "";
    dayRows(input).forEach((r, i) => {
      const row = ws.getRow(4 + i);
      const values = [r.day === lastDay ? "" : r.day, r.slot, r.time, r.role, r.people.join(", ") || "—", r.people.length, ...(withNeeds ? [r.needed ?? 0] : [])];
      values.forEach((v, c) => {
        const cell = row.getCell(c + 1);
        cell.value = v;
        cell.border = borders;
        cell.alignment = { vertical: "middle", horizontal: c >= 5 ? "center" : "left", wrapText: c === 4 };
      });
      row.getCell(1).font = { bold: true };
      if (r.day !== lastDay) {
        for (let c = 1; c <= values.length; c++) row.getCell(c).border = { ...borders, top: { style: "medium", color: { argb: argb(INK) } } };
      }
      if (withNeeds && r.needed !== null && r.people.length < r.needed) {
        row.getCell(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb("#FBE6DD") } };
        row.getCell(6).font = { bold: true, color: { argb: argb("#9A3412") } };
      }
      lastDay = r.day;
    });
  }

  if (format === "all" || format === "list") {
    const ws = wb.addWorksheet("Turnos", { views: [{ state: "frozen", ySplit: 3 }] });
    setup(ws);
    title(ws, 8, "Una fila por turno. Puedes filtrar por persona, puesto o día.");
    header(ws, 3, ["Fecha", "Día", "Persona", "Puesto", "Franja", "Entrada", "Salida", "Horas"]);
    ws.columns = [{ width: 12 }, { width: 12 }, { width: 22 }, { width: 16 }, { width: 18 }, { width: 9 }, { width: 9 }, { width: 8 }];
    const rows = shiftRows(input);
    rows.forEach((r, i) => {
      const row = ws.getRow(4 + i);
      [r.dateEs, r.day, r.person, r.role, r.slot, r.start, r.end, r.hours].forEach((v, c) => {
        const cell = row.getCell(c + 1);
        cell.value = v;
        cell.border = borders;
        if (i % 2) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(GROUND) } };
      });
      row.getCell(8).numFmt = "0.##";
    });
    const total = ws.getRow(4 + rows.length);
    total.getCell(7).value = "Total";
    total.getCell(7).font = { bold: true };
    total.getCell(8).value = { formula: `SUM(H4:H${3 + rows.length})`, result: rows.reduce((a, r) => a + r.hours, 0) };
    total.getCell(8).font = { bold: true };
    total.getCell(8).numFmt = "0.##";
    if (rows.length) ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3 + rows.length, column: 8 } };
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
