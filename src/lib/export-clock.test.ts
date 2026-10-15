import { describe, expect, it } from "vitest";
import { clockByDayTable, clockDetailTable, clockSummaryTable, monthLabel } from "./export-clock";
import { tableCsv } from "./export-table";
import type { ClockDayRow, ClockRecord } from "./fichajes";

const rec = (id: string, start: string, end: string | null, extra: Partial<ClockRecord> = {}): ClockRecord => ({
  id,
  employeeId: "e1",
  start,
  end,
  missingEnd: false,
  edited: false,
  ...extra,
});

const rows: ClockDayRow[] = [
  { date: "2026-10-05", name: "Marta", role: "Sala", records: [rec("a", "2026-10-05T07:00:00Z", "2026-10-05T15:00:00Z")], planned: "Mañana 09:00–17:00", plannedHours: 8, status: "ok" },
  { date: "2026-10-06", name: "Marta", role: "Sala", records: [rec("b", "2026-10-06T07:30:00Z", "2026-10-06T15:00:00Z", { edited: true })], planned: "Mañana 09:00–17:00", plannedHours: 8, status: "late", lastReason: "Fichó en papel" },
  { date: "2026-10-06", name: "Jordi", role: "Cocina", records: [], planned: "Noche 17:00–01:00", plannedHours: 8, status: "missing" },
];
const now = new Date("2026-10-15T10:00:00Z");

describe("exportar el registro de jornada", () => {
  it("detallado: una fila por tramo, con el motivo de la corrección", () => {
    const t = clockDetailTable(rows, "2026-10", "Bar Ñandú", now);
    expect(t.rows).toHaveLength(3);
    expect(t.rows[1]).toEqual(["06/10/2026", "Marta", "Sala", "09:30", "17:00", 7.5, "Mañana 09:00–17:00", "Entró tarde", "Sí", "Fichó en papel"]);
    expect(t.title).toContain("octubre de 2026");
  });

  it("resumen: horas fichadas frente a previstas y contadores", () => {
    const t = clockSummaryTable(rows, "2026-10", "Bar", now);
    const marta = t.rows.find((r) => r[0] === "Marta")!;
    expect(marta.slice(2, 10)).toEqual([2, 15.5, 16, -0.5, 1, 0, 0, 1]);
    expect(t.rows.find((r) => r[0] === "Jordi")![8]).toBe(1);
    expect(t.totals?.[3]).toBe(15.5);
  });

  it("por día: una columna por cada día del mes y el total", () => {
    const t = clockByDayTable(rows, "2026-10", "Bar", now);
    expect(t.header).toHaveLength(2 + 31 + 1);
    expect(t.header[2]).toBe("J 1");
    const marta = t.rows.find((r) => r[0] === "Marta")!;
    expect(marta[2 + 4]).toBe(8);
    expect(marta[marta.length - 1]).toBe(15.5);
  });

  it("CSV con «;», coma decimal y BOM", () => {
    const csv = tableCsv(clockSummaryTable(rows, "2026-10", "Bar", now));
    expect(csv.startsWith("﻿Persona;Puesto;")).toBe(true);
    expect(csv).toContain("Marta;Sala;2;15,5;16;-0,5");
    expect(monthLabel("2026-01")).toBe("enero de 2026");
  });
});
