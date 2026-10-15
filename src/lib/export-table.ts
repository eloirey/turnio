/**
 * Tablas para exportar: la misma tabla sale en CSV (texto) o en Excel.
 * El Excel lo monta el navegador con exceljs, que solo se descarga al usarlo.
 */

export type Cell = string | number | null;

export interface Table {
  /** Nombre de la hoja de Excel (máx. 31 caracteres). */
  sheet: string;
  /** Primera línea de la hoja: qué es y de cuándo. */
  title: string;
  /** Segunda línea, más pequeña: cómo leerla. */
  subtitle?: string;
  header: string[];
  rows: Cell[][];
  /** Ancho de cada columna en Excel (en caracteres). */
  widths?: number[];
  /** Columnas con horas en decimal (se muestran con dos decimales). */
  hourColumns?: number[];
  /** Fila final de totales (opcional). */
  totals?: Cell[];
  /** Color de fondo por celda (fila, columna) → color hex, para resaltar. */
  highlight?: (row: number, col: number) => string | null;
}

/** Texto para Excel en España: «;» como separador, coma decimal y BOM para las tildes. */
export function tableCsv(t: Table): string {
  const fmt = (v: Cell) => {
    if (v === null || v === undefined) return "";
    if (typeof v === "number") return String(Math.round(v * 100) / 100).replace(".", ",");
    return /[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  };
  const lines = [t.header.map(fmt).join(";"), ...t.rows.map((r) => r.map(fmt).join(";"))];
  if (t.totals) lines.push(t.totals.map(fmt).join(";"));
  return "﻿" + lines.join("\r\n") + "\r\n";
}

const argb = (hex: string) => "FF" + hex.replace("#", "").toUpperCase();
const ACCENT = "#1F5C46";
const LINE = "#E4E1D8";
const MUTED = "#6B6860";
const GROUND = "#F4F3EE";

/** Un Excel con una hoja por tabla: cabecera en verde, filtros y la cabecera fija. */
export async function tablesToXlsx(tables: Table[]): Promise<Blob> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Rotafy";
  wb.created = new Date();
  const border = { style: "thin" as const, color: { argb: argb(LINE) } };
  const borders = { top: border, left: border, bottom: border, right: border };

  for (const t of tables) {
    const ws = wb.addWorksheet(t.sheet.slice(0, 31), { views: [{ state: "frozen", ySplit: 3, xSplit: 1 }] });
    ws.pageSetup = { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } };
    const cols = t.header.length;
    ws.mergeCells(1, 1, 1, cols);
    ws.getCell(1, 1).value = t.title;
    ws.getCell(1, 1).font = { bold: true, size: 14 };
    ws.getRow(1).height = 22;
    if (t.subtitle) {
      ws.mergeCells(2, 1, 2, cols);
      ws.getCell(2, 1).value = t.subtitle;
      ws.getCell(2, 1).font = { size: 10, color: { argb: argb(MUTED) } };
    }
    const head = ws.getRow(3);
    t.header.forEach((h, i) => {
      const c = head.getCell(i + 1);
      c.value = h;
      c.font = { bold: true, color: { argb: "FFFFFFFF" } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(ACCENT) } };
      c.alignment = { vertical: "middle", horizontal: i === 0 ? "left" : "center", wrapText: true };
      c.border = borders;
    });
    head.height = 30;
    ws.columns = t.header.map((h, i) => ({ width: t.widths?.[i] ?? Math.max(10, Math.min(40, h.length + 4)) }));

    const hours = new Set(t.hourColumns ?? []);
    const write = (rowIndex: number, values: Cell[], dataRow: number | null, bold = false) => {
      const row = ws.getRow(rowIndex);
      values.forEach((v, i) => {
        const c = row.getCell(i + 1);
        c.value = v === null ? null : v;
        c.border = borders;
        c.alignment = { vertical: "middle", horizontal: typeof v === "number" ? "right" : "left", wrapText: typeof v === "string" && v.length > 30 };
        if (hours.has(i) && typeof v === "number") c.numFmt = "0.00";
        if (bold) c.font = { bold: true };
        const color = dataRow !== null ? t.highlight?.(dataRow, i) : null;
        if (color) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(color) } };
        else if (dataRow !== null && dataRow % 2) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(GROUND) } };
      });
    };
    t.rows.forEach((r, i) => write(4 + i, r, i));
    if (t.totals) write(4 + t.rows.length, t.totals, null, true);
    if (t.rows.length) ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3 + t.rows.length, column: cols } };
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

/** Descarga un archivo creado en el navegador. */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
