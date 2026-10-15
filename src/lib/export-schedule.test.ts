import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { buildWorkbook } from "@/components/cuadrante/ExportDialog";
import { dayRows, exportFilename, gridRows, scheduleCsv, shiftRows, type ScheduleExportInput } from "./export-schedule";
import { getTemplate, templateDemand, templateRoles, templateShifts, templateTeam } from "./schedule/templates";
import { generateSchedule } from "./schedule";
import { DEFAULT_RULES } from "./schedule/defaults";

function sample(): ScheduleExportInput {
  const t = getTemplate("bar");
  const roles = templateRoles(t);
  const shifts = templateShifts(t);
  const demand = templateDemand(t, roles);
  const team = templateTeam(t, roles);
  const grid = generateSchedule(team, demand, shifts, DEFAULT_RULES);
  const absences = { [team[0].id]: [null, null, null, null, null, "vacaciones", "vacaciones"] };
  grid[team[0].id][5] = "L";
  grid[team[0].id][6] = "L";
  return { localName: "Bar Ñandú", monday: "2026-10-12", employees: team, roles, shifts, grid, absences, demand };
}

describe("exportar el cuadrante", () => {
  it("cuadrícula: una fila por persona, horas sumadas y ausencias", () => {
    const input = sample();
    const rows = gridRows(input);
    expect(rows).toHaveLength(input.employees.length);
    expect(rows[0].cells[5]).toEqual({ kind: "absent", text: "Vacaciones" });
    const worked = rows[1].cells.filter((c) => c.kind === "shift").length;
    expect(rows[1].hours).toBe(worked * 8);
  });

  it("lista: un turno por fila, ordenada por día y con fecha española", () => {
    const input = sample();
    const rows = shiftRows(input);
    const total = Object.values(input.grid).flat().filter((c) => c !== "L").length;
    expect(rows).toHaveLength(total);
    expect(rows[0].dateEs).toBe("12/10/2026");
    expect(rows.map((r) => r.date)).toEqual([...rows.map((r) => r.date)].sort());
  });

  it("por día: personas por franja y puesto, con lo necesario", () => {
    const rows = dayRows(sample());
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r.needed).not.toBeNull();
  });

  it("CSV para Excel en español", () => {
    const csv = scheduleCsv(sample());
    expect(csv.startsWith("﻿Fecha;Día;Persona;Puesto;Franja;Entrada;Salida;Horas\r\n")).toBe(true);
    expect(csv).toContain("12/10/2026;lunes;");
  });

  it("nombre de archivo sin acentos ni espacios", () => {
    expect(exportFilename("Bar Ñandú", "2026-10-12", "xlsx")).toBe("cuadrante-bar-nandu-2026-10-12.xlsx");
  });

  it("el Excel completo se abre con sus tres hojas", async () => {
    const input = sample();
    const blob = await buildWorkbook(input, "all");
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await blob.arrayBuffer());
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Cuadrante", "Por día", "Turnos"]);
    const grid = wb.getWorksheet("Cuadrante")!;
    expect(grid.getCell("A4").value).toBe(input.employees[0].name);
    expect(grid.getCell("H4").value).toBe("Vacaciones");
    const list = wb.getWorksheet("Turnos")!;
    expect(list.getCell("A3").value).toBe("Fecha");
    expect(list.autoFilter).toBeTruthy();
  });
});
