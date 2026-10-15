/**
 * Exportar el cuadrante de una semana. Aquí solo se preparan las filas (fácil
 * de probar); el Excel con colores lo monta el navegador con exceljs.
 */
import { ABSENCE_LABELS, type AbsenceReason } from "@/lib/data/mappers";
import {
  addDays,
  DAY_LONG,
  DAY_SHORT,
  dayOfMonth,
  isoWeekNumber,
  weekRangeLabel,
} from "@/lib/dates";
import type { Table } from "@/lib/export-table";
import type { Role } from "@/lib/roles";
import {
  activeSlots,
  FREE,
  type AbsenceMap,
  type Demand,
  type Grid,
  type ShiftCatalog,
} from "@/lib/schedule/types";

export interface ScheduleExportInput {
  localName: string;
  monday: string;
  employees: {
    id: string;
    name: string;
    role: string;
    contractHours: number;
  }[];
  roles: Role[];
  shifts: ShiftCatalog;
  grid: Grid;
  absences?: AbsenceMap;
  demand?: Demand;
}



export interface GridCell {
  kind: "shift" | "free" | "absent";
  text: string;
  /** Solo en turnos: color del puesto y código de franja. */
  roleColor?: number;
  slot?: string;
}

export interface GridRow {
  name: string;
  role: string;
  cells: GridCell[];
  hours: number;
  contract: number;
}

const roleName = (roles: Role[], key: string) =>
  roles.find((r) => r.key === key)?.name ?? key;

/** Hoja «Cuadrante»: una fila por persona y una columna por día. */
export function gridRows(input: ScheduleExportInput): GridRow[] {
  const { employees, roles, shifts, grid, absences = {} } = input;
  return employees.map((e) => {
    let hours = 0;
    const cells: GridCell[] = Array.from({ length: 7 }, (_, d) => {
      const code = grid[e.id]?.[d] ?? FREE;
      const s = code !== FREE ? shifts[code] : undefined;
      if (s) {
        hours += s.hours;
        return {
          kind: "shift",
          text: `${s.label}\n${s.start}–${s.end}`,
          roleColor: roles.find((r) => r.key === e.role)?.color,
          slot: code,
        };
      }
      const absent = absences[e.id]?.[d] as AbsenceReason | null | undefined;
      if (absent)
        return { kind: "absent", text: ABSENCE_LABELS[absent] ?? "Ausencia" };
      return { kind: "free", text: "Libre" };
    });
    return {
      name: e.name,
      role: roleName(roles, e.role),
      cells,
      hours,
      contract: e.contractHours,
    };
  });
}

export interface ShiftRow {
  date: string;
  /** dd/mm/aaaa, como lo escribe Excel en España. */
  dateEs: string;
  day: string;
  person: string;
  role: string;
  slot: string;
  start: string;
  end: string;
  hours: number;
}

/** Hoja «Turnos»: una fila por turno, ordenadas por día y hora. */
export function shiftRows(input: ScheduleExportInput): ShiftRow[] {
  const { employees, roles, shifts, grid, monday } = input;
  const order = activeSlots(shifts);
  const rows: { row: ShiftRow; o: number; d: number }[] = [];
  for (const e of employees) {
    (grid[e.id] ?? []).forEach((code, d) => {
      const s = code !== FREE ? shifts[code] : undefined;
      if (!s) return;
      const date = addDays(monday, d);
      rows.push({
        o: order.indexOf(code) === -1 ? 99 : order.indexOf(code),
        d,
        row: {
          date,
          dateEs: `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`,
          day: DAY_LONG[d],
          person: e.name,
          role: roleName(roles, e.role),
          slot: s.label,
          start: s.start,
          end: s.end,
          hours: s.hours,
        },
      });
    });
  }
  rows.sort(
    (a, b) =>
      a.d - b.d ||
      a.o - b.o ||
      a.row.role.localeCompare(b.row.role, "es") ||
      a.row.person.localeCompare(b.row.person, "es"),
  );
  return rows.map((r) => r.row);
}

export interface DayRow {
  day: string;
  slot: string;
  time: string;
  role: string;
  people: string[];
  needed: number | null;
}

/** Hoja «Por día»: quién trabaja en cada franja de cada día, por puesto. */
export function dayRows(input: ScheduleExportInput): DayRow[] {
  const { employees, roles, shifts, grid, monday, demand } = input;
  const rows: DayRow[] = [];
  for (let d = 0; d < 7; d++) {
    for (const code of activeSlots(shifts)) {
      const s = shifts[code];
      for (const role of roles) {
        const people = employees
          .filter((e) => e.role === role.key && grid[e.id]?.[d] === code)
          .map((e) => e.name);
        const needed = demand?.[d]?.[code]?.[role.key] ?? 0;
        if (!people.length && !needed) continue;
        rows.push({
          day: `${DAY_SHORT[d]} ${dayOfMonth(monday, d)}`,
          slot: s.label,
          time: `${s.start}–${s.end}`,
          role: role.name,
          people,
          needed: demand ? needed : null,
        });
      }
    }
  }
  return rows;
}

/** Texto para Excel en España: «;» como separador, coma decimal y BOM para los acentos. */
export function scheduleCsv(input: ScheduleExportInput): string {
  const esc = (v: string) =>
    /[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  const lines = [
    [
      "Fecha",
      "Día",
      "Persona",
      "Puesto",
      "Franja",
      "Entrada",
      "Salida",
      "Horas",
    ].join(";"),
  ];
  for (const r of shiftRows(input)) {
    lines.push(
      [
        r.dateEs,
        r.day,
        r.person,
        r.role,
        r.slot,
        r.start,
        r.end,
        String(r.hours).replace(".", ","),
      ]
        .map(esc)
        .join(";"),
    );
  }
  return "﻿" + lines.join("\r\n") + "\r\n";
}

export function exportTitle(
  input: Pick<ScheduleExportInput, "localName" | "monday">,
): string {
  return `${input.localName} · Semana ${isoWeekNumber(input.monday)} · ${weekRangeLabel(input.monday)}`;
}

export function exportFilename(
  localName: string,
  monday: string,
  ext: "xlsx" | "csv",
  suffix = "",
): string {
  const slug =
    localName
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "cuadrante";
  return `cuadrante-${slug}-${monday}${suffix}.${ext}`;
}

// ---------- Las mismas hojas como tablas (para el CSV) ----------

/** Modelos para elegir al exportar. «Todo» solo existe en Excel (tiene varias hojas). */
export type ScheduleModel = "all" | "grid" | "byDay" | "list";

export const SCHEDULE_MODELS: { key: ScheduleModel; title: string; detail: string; csv: boolean }[] = [
  { key: "grid", title: "Cuadrante semanal", detail: "Personas en filas y días en columnas, como el del tablón.", csv: true },
  { key: "byDay", title: "Por día y franja", detail: "Quién trabaja en cada franja de cada día, por puesto.", csv: true },
  { key: "list", title: "Lista de turnos", detail: "Una fila por turno con fecha, horario y horas. Para nóminas o la gestoría.", csv: true },
  { key: "all", title: "Todo junto", detail: "Las tres anteriores en un mismo Excel, una en cada hoja.", csv: false },
];

export function gridTable(input: ScheduleExportInput): Table {
  return {
    sheet: "Cuadrante",
    title: exportTitle(input),
    header: ["Persona", "Puesto", ...DAY_SHORT.map((d, i) => `${d} ${dayOfMonth(input.monday, i)}`), "Horas", "Contrato"],
    rows: gridRows(input).map((r) => [r.name, r.role, ...r.cells.map((c) => c.text.replace("\n", " ")), r.hours, r.contract]),
  };
}

export function dayTable(input: ScheduleExportInput): Table {
  const withNeeds = Boolean(input.demand);
  return {
    sheet: "Por día",
    title: exportTitle(input),
    header: ["Día", "Franja", "Horario", "Puesto", "Personas", "Cuántas", ...(withNeeds ? ["Necesarias"] : [])],
    rows: dayRows(input).map((r) => [r.day, r.slot, r.time, r.role, r.people.join(", "), r.people.length, ...(withNeeds ? [r.needed ?? 0] : [])]),
  };
}

export function listTable(input: ScheduleExportInput): Table {
  return {
    sheet: "Turnos",
    title: exportTitle(input),
    header: ["Fecha", "Día", "Persona", "Puesto", "Franja", "Entrada", "Salida", "Horas"],
    rows: shiftRows(input).map((r) => [r.dateEs, r.day, r.person, r.role, r.slot, r.start, r.end, r.hours]),
  };
}

export function scheduleTable(model: Exclude<ScheduleModel, "all">, input: ScheduleExportInput): Table {
  return model === "grid" ? gridTable(input) : model === "byDay" ? dayTable(input) : listTable(input);
}
