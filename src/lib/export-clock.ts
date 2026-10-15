/**
 * Exportar el registro de jornada de un mes en tres modelos. Cada modelo es
 * una tabla que luego sale en Excel o en CSV.
 */
import { addDays } from "@/lib/dates";
import { madridTime, recordHours, STATUS_LABEL, type ClockDayRow } from "@/lib/fichajes";
import type { Table } from "@/lib/export-table";

export type ClockModel = "detail" | "summary" | "byDay";

export const CLOCK_MODELS: { key: ClockModel; title: string; detail: string }[] = [
  { key: "detail", title: "Registro detallado", detail: "Una fila por cada entrada y salida, con las correcciones y su motivo. Es el que pide la Inspección." },
  { key: "summary", title: "Resumen por persona", detail: "Días trabajados, horas fichadas frente a las previstas, retrasos y olvidos del mes." },
  { key: "byDay", title: "Horas por día", detail: "Personas en filas y los días del mes en columnas, con el total. Cómodo para nóminas." },
];

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTHS[m - 1]} de ${y}`;
}

/** «Octubre de 2026», para listas. */
export function monthOption(month: string): string {
  const l = monthLabel(month);
  return l[0].toUpperCase() + l.slice(1);
}

const dateEs = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const round2 = (n: number) => Math.round(n * 100) / 100;
const dayHours = (row: ClockDayRow, now: Date) => row.records.reduce((a, r) => a + recordHours(r, now), 0);

const OK = "#DDF0E4";
const LATE = "#FFE8C7";
const BAD = "#FBDCD0";
const statusColor = (kind: string) => (kind === "ok" ? OK : kind === "late" || kind === "early" ? LATE : kind === "forgot" || kind === "missing" ? BAD : null);

/** Una fila por tramo (entrada y salida). */
export function clockDetailTable(rows: ClockDayRow[], month: string, localName: string, now: Date): Table {
  const out: (string | number | null)[][] = [];
  const kinds: string[] = [];
  for (const row of rows) {
    const tramos = row.records.length ? row.records : [null];
    for (const r of tramos) {
      out.push([
        dateEs(row.date),
        row.name,
        row.role,
        r ? madridTime(r.start) : "",
        r?.end ? madridTime(r.end) : r?.missingEnd ? "Sin fichar" : r ? "En curso" : "",
        r ? round2(recordHours(r, now)) : 0,
        row.planned,
        STATUS_LABEL[row.status] ?? "",
        r?.edited ? "Sí" : "No",
        r?.edited ? (row.lastReason ?? "") : "",
      ]);
      kinds.push(row.status);
    }
  }
  return {
    sheet: "Registro",
    title: `Registro de jornada · ${localName} · ${monthLabel(month)}`,
    subtitle: "Una fila por cada entrada y salida. Las horas van en decimal (7,50 = 7 h 30 min).",
    header: ["Fecha", "Persona", "Puesto", "Entrada", "Salida", "Horas", "Turno previsto", "Estado", "Corregido", "Motivo de la corrección"],
    rows: out,
    widths: [12, 22, 16, 9, 11, 8, 26, 22, 10, 36],
    hourColumns: [5],
    highlight: (r, c) => (c === 7 ? statusColor(kinds[r]) : null),
  };
}

/** Una fila por persona con los totales del mes. */
export function clockSummaryTable(rows: ClockDayRow[], month: string, localName: string, now: Date): Table {
  const people = new Map<string, { name: string; role: string; days: number; worked: number; planned: number; late: number; forgot: number; missing: number; edited: number }>();
  for (const row of rows) {
    const p = people.get(row.name) ?? { name: row.name, role: row.role, days: 0, worked: 0, planned: 0, late: 0, forgot: 0, missing: 0, edited: 0 };
    if (row.records.length) p.days++;
    p.worked += dayHours(row, now);
    p.planned += row.plannedHours ?? 0;
    if (row.status === "late" || row.status === "early") p.late++;
    if (row.status === "forgot") p.forgot++;
    if (row.status === "missing") p.missing++;
    if (row.records.some((r) => r.edited)) p.edited++;
    people.set(row.name, p);
  }
  const list = [...people.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
  const totals = list.reduce((t, p) => ({ worked: t.worked + p.worked, planned: t.planned + p.planned }), { worked: 0, planned: 0 });
  return {
    sheet: "Resumen",
    title: `Resumen del registro · ${localName} · ${monthLabel(month)}`,
    subtitle: "Horas en decimal (7,50 = 7 h 30 min). Diferencia = fichadas − previstas.",
    header: ["Persona", "Puesto", "Días con fichaje", "Horas fichadas", "Horas previstas", "Diferencia", "Tarde o antes", "Olvidó la salida", "No fichó", "Días corregidos"],
    rows: list.map((p) => [p.name, p.role, p.days, round2(p.worked), round2(p.planned), round2(p.worked - p.planned), p.late, p.forgot, p.missing, p.edited]),
    widths: [22, 16, 12, 12, 12, 11, 11, 13, 9, 12],
    hourColumns: [3, 4, 5],
    totals: ["Total", "", null, round2(totals.worked), round2(totals.planned), round2(totals.worked - totals.planned), null, null, null, null],
    highlight: (r, c) => {
      const p = list[r];
      if (c === 7 && p.forgot) return BAD;
      if (c === 8 && p.missing) return BAD;
      if (c === 6 && p.late) return LATE;
      return null;
    },
  };
}

/** Personas en filas, días del mes en columnas: horas fichadas cada día. */
export function clockByDayTable(rows: ClockDayRow[], month: string, localName: string, now: Date): Table {
  const first = `${month}-01`;
  const days: string[] = [];
  for (let d = first; d.startsWith(month); d = addDays(d, 1)) days.push(d);
  const people = new Map<string, { role: string; hours: (number | null)[]; kinds: (string | null)[] }>();
  for (const row of rows) {
    const p = people.get(row.name) ?? { role: row.role, hours: days.map(() => null), kinds: days.map(() => null) };
    const i = days.indexOf(row.date);
    if (i >= 0) {
      p.hours[i] = round2((p.hours[i] ?? 0) + dayHours(row, now));
      p.kinds[i] = row.status;
    }
    people.set(row.name, p);
  }
  const names = [...people.keys()].sort((a, b) => a.localeCompare(b, "es"));
  const WD = ["L", "M", "X", "J", "V", "S", "D"];
  const header = ["Persona", "Puesto", ...days.map((d) => `${WD[(new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7]} ${Number(d.slice(8))}`), "Total"];
  const body = names.map((n) => {
    const p = people.get(n)!;
    return [n, p.role, ...p.hours, round2(p.hours.reduce<number>((a, h) => a + (h ?? 0), 0))];
  });
  return {
    sheet: "Horas por día",
    title: `Horas fichadas por día · ${localName} · ${monthLabel(month)}`,
    subtitle: "Horas en decimal (7,50 = 7 h 30 min). Vacío = no tenía turno ni fichó. Verde: correcto · naranja: tarde o antes · rojo: revisar.",
    header,
    rows: body,
    widths: [22, 14, ...days.map(() => 6.5), 9],
    hourColumns: [...days.map((_, i) => i + 2), days.length + 2],
    highlight: (r, c) => {
      if (c < 2 || c > days.length + 1) return null;
      return statusColor(people.get(names[r])!.kinds[c - 2] ?? "");
    },
  };
}

export function clockTable(model: ClockModel, rows: ClockDayRow[], month: string, localName: string, now: Date): Table {
  if (model === "summary") return clockSummaryTable(rows, month, localName, now);
  if (model === "byDay") return clockByDayTable(rows, month, localName, now);
  return clockDetailTable(rows, month, localName, now);
}
