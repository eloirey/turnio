"use client";

import { ExportChooser } from "@/components/ExportChooser";
import { exportFilename, exportTitle, dayRows, gridRows, SCHEDULE_MODELS, scheduleTable, shiftRows, type ScheduleExportInput, type ScheduleModel } from "@/lib/export-schedule";
import { saveBlob, tableCsv } from "@/lib/export-table";
import { DAY_SHORT, dayOfMonth } from "@/lib/dates";
import { PALETTE } from "@/lib/roles";

/** Exportar el cuadrante: primero qué (modelo) y después en qué formato. */
export function ExportDialog({ input, onClose, onError }: { input: ScheduleExportInput; onClose: () => void; onError: (m: string) => void }) {
  return (
    <ExportChooser
      title="Exportar el cuadrante"
      subtitle={exportTitle(input)}
      models={SCHEDULE_MODELS}
      storageKey="rotafy:exportar-cuadrante"
      onClose={onClose}
      onDownload={async (model, format) => {
        try {
          if (format === "csv" && model !== "all") {
            const suffix = model === "grid" ? "" : model === "byDay" ? "-por-dia" : "-turnos";
            saveBlob(new Blob([tableCsv(scheduleTable(model, input))], { type: "text/csv;charset=utf-8" }), exportFilename(input.localName, input.monday, "csv", suffix));
          } else {
            saveBlob(await buildWorkbook(input, model), exportFilename(input.localName, input.monday, "xlsx"));
          }
          onClose();
        } catch {
          onError("No se ha podido crear el archivo. Inténtalo de nuevo.");
        }
      }}
    />
  );
}

// ---------- Excel ----------

const argb = (hex: string) => "FF" + hex.replace("#", "").toUpperCase();
const INK = "#1B1B1A";
const MUTED = "#6B6860";
const LINE = "#E4E1D8";
const GROUND = "#F4F3EE";
const ACCENT = "#1F5C46";

export async function buildWorkbook(input: ScheduleExportInput, format: ScheduleModel): Promise<Blob> {
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
