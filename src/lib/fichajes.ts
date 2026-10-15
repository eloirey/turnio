/**
 * Fichajes (registro de jornada): cálculos puros, sin base de datos.
 *
 * Los instantes se guardan en UTC (ISO). Todo lo que ve la gente (fechas y
 * horas) se muestra en hora de Madrid, que es donde están los locales.
 * Un tramo pertenece al día en que empieza (hora de Madrid).
 */
import { shiftSegments } from "@/lib/schedule/rules";
import type { ShiftDef } from "@/lib/schedule/types";

export interface ClockRecord {
  id: string;
  employeeId: string;
  /** Entrada (ISO, UTC). */
  start: string;
  /** Salida (ISO, UTC) o null si sigue abierto o se olvidó. */
  end: string | null;
  /** Se olvidó de fichar la salida: cuenta 0 horas hasta que el encargado lo corrija. */
  missingEnd: boolean;
  edited: boolean;
  /** Dónde fichó (si el local lo comprueba). Nunca hay coordenadas. */
  placeIn?: ClockPlace | null;
  placeOut?: ClockPlace | null;
  /** Distancia aproximada al local en metros, si fichó fuera. */
  distIn?: number | null;
  distOut?: number | null;
}

export type ClockPlace = "local" | "fuera" | "sin_datos" | "teletrabajo";

const PLACE_LABEL: Record<ClockPlace, string> = {
  local: "En el local",
  fuera: "Fuera del local",
  sin_datos: "Sin ubicación",
  teletrabajo: "Teletrabajo",
};

/** «Fuera del local (a 1,2 km)» */
export function placeText(place: ClockPlace | null | undefined, dist?: number | null): string {
  if (!place) return "";
  if (place !== "fuera" || dist == null) return PLACE_LABEL[place];
  return `${PLACE_LABEL.fuera} (a ${dist >= 1000 ? `${(Math.round(dist / 100) / 10).toString().replace(".", ",")} km` : `${dist} m`})`;
}

/** ¿Algún tramo del día se fichó fuera o sin ubicación? */
export function placeFlag(records: ClockRecord[]): "fuera" | "sin_datos" | null {
  if (records.some((r) => r.placeIn === "fuera" || r.placeOut === "fuera")) return "fuera";
  if (records.some((r) => r.placeIn === "sin_datos" || r.placeOut === "sin_datos")) return "sin_datos";
  return null;
}

export interface ClockChange {
  recordId: string;
  employeeId: string;
  action: "crear" | "editar" | "borrar";
  before: { entrada: string; salida: string | null } | null;
  after: { entrada: string; salida: string | null } | null;
  reason: string;
  at: string;
}

const TZ = "Europe/Madrid";
const dateFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const timeFmt = new Intl.DateTimeFormat("es-ES", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const partsFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** "2026-10-14T15:02:00Z" → "2026-10-14" (día en Madrid). */
export function madridDate(iso: string | Date): string {
  return dateFmt.format(typeof iso === "string" ? new Date(iso) : iso);
}

/** "2026-10-14T15:02:00Z" → "17:02" (hora en Madrid). */
export function madridTime(iso: string | Date): string {
  return timeFmt.format(typeof iso === "string" ? new Date(iso) : iso);
}

/** Diferencia entre la hora de Madrid y UTC en ese instante, en milisegundos. */
function madridOffset(ms: number): number {
  const p = Object.fromEntries(partsFmt.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/** Fecha y hora de Madrid ("2026-10-14", "17:00") → instante ISO en UTC. Funciona en cambios de hora. */
export function madridToIso(dateISO: string, hhmm: string): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  const wall = Date.UTC(y, m - 1, d, h, mi);
  let ms = wall - madridOffset(wall);
  ms = wall - madridOffset(ms); // segunda pasada por si el desfase cambia ese día
  return new Date(ms).toISOString();
}

/** Horas trabajadas de un tramo. Si sigue abierto, hasta `now`. Si se olvidó la salida, 0. */
export function recordHours(r: ClockRecord, now: Date = new Date()): number {
  if (r.missingEnd) return 0;
  const end = r.end ? Date.parse(r.end) : now.getTime();
  return Math.max(0, (end - Date.parse(r.start)) / 3_600_000);
}

/** 7,5 → "7 h 30 min"; 8 → "8 h"; 0,2 → "12 min" */
export function formatHours(h: number): string {
  const total = Math.round(h * 60);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  if (hh === 0) return `${mm} min`;
  return mm ? `${hh} h ${mm} min` : `${hh} h`;
}

/** 7,5 → "7:30" (para tablas y Excel). */
export function hoursClock(h: number): string {
  const total = Math.round(h * 60);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export type DayStatusKind =
  | "none" // ni turno ni fichajes
  | "pending" // tiene turno y aún no ha empezado
  | "ok"
  | "late" // entró tarde
  | "early" // salió antes
  | "open" // está trabajando ahora
  | "forgot" // se olvidó de fichar la salida
  | "missing" // tenía turno y no fichó
  | "unplanned"; // fichó sin tener turno

export interface DayStatus {
  kind: DayStatusKind;
  worked: number;
  planned: number;
  /** Minutos de retraso al entrar (si kind = late). */
  lateMinutes: number;
  /** Minutos que se fue antes (si kind = early). */
  earlyMinutes: number;
}

/** Inicio y fin previstos de un turno en ese día, como instantes. */
export function plannedWindow(dateISO: string, shift: Pick<ShiftDef, "start" | "end" | "start2" | "end2">) {
  // Entrada del primer tramo y salida del último (en un partido, la de la noche).
  const segs = shiftSegments(shift);
  const last = segs[segs.length - 1];
  const endTime = shift.start2 && shift.end2 ? shift.end2 : shift.end;
  const start = Date.parse(madridToIso(dateISO, shift.start));
  const end = Date.parse(madridToIso(last.end >= 24 ? addOneDay(dateISO) : dateISO, endTime));
  return { start, end };
}

function addOneDay(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Estado de un día de una persona: compara lo que fichó con su turno previsto.
 * `marginMinutes` es la tolerancia antes de marcar un retraso o una salida temprana.
 */
export function dayStatus(
  dateISO: string,
  records: ClockRecord[],
  shift: Pick<ShiftDef, "start" | "end" | "hours"> | null,
  now: Date = new Date(),
  marginMinutes = 10,
  /** Día desde el que el local ficha: antes, un día sin fichajes no se revisa. */
  since?: string | null,
): DayStatus {
  const worked = records.reduce((a, r) => a + recordHours(r, now), 0);
  const planned = shift?.hours ?? 0;
  const base = { worked, planned, lateMinutes: 0, earlyMinutes: 0 };
  const margin = marginMinutes * 60_000;

  if (records.some((r) => r.missingEnd)) return { ...base, kind: "forgot" };
  if (records.some((r) => !r.end)) return { ...base, kind: "open" };

  if (!shift) return { ...base, kind: records.length ? "unplanned" : "none" };
  if (!records.length && since && dateISO < since) return { ...base, kind: "none" };

  const win = plannedWindow(dateISO, shift);
  if (!records.length) return { ...base, kind: now.getTime() > win.start + margin ? "missing" : "pending" };

  const sorted = [...records].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const firstIn = Date.parse(sorted[0].start);
  const lastOut = Math.max(...sorted.map((r) => (r.end ? Date.parse(r.end) : now.getTime())));
  if (firstIn > win.start + margin) return { ...base, kind: "late", lateMinutes: Math.round((firstIn - win.start) / 60_000) };
  if (lastOut < win.end - margin) return { ...base, kind: "early", earlyMinutes: Math.round((win.end - lastOut) / 60_000) };
  return { ...base, kind: "ok" };
}

export const STATUS_LABEL: Record<DayStatusKind, string> = {
  none: "",
  pending: "Pendiente",
  ok: "Correcto",
  late: "Entró tarde",
  early: "Salió antes",
  open: "Trabajando",
  forgot: "Olvidó fichar la salida",
  missing: "No fichó",
  unplanned: "Sin turno previsto",
};

/** ¿Este estado necesita que el encargado lo mire? */
export function needsAttention(kind: DayStatusKind): boolean {
  return kind === "forgot" || kind === "missing";
}

/** Agrupa los tramos por persona y día (de Madrid). */
export function groupByEmployeeDay(records: ClockRecord[]): Map<string, ClockRecord[]> {
  const map = new Map<string, ClockRecord[]>();
  for (const r of records) {
    const key = `${r.employeeId}|${madridDate(r.start)}`;
    const list = map.get(key);
    if (list) list.push(r);
    else map.set(key, [r]);
  }
  for (const list of map.values()) list.sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  return map;
}

/** Un día de una persona en el registro (lo que se exporta). */
export interface ClockDayRow {
  date: string;
  name: string;
  role: string;
  records: ClockRecord[];
  /** Turno previsto, en texto («Mañana 09:00–17:00»), o vacío. */
  planned: string;
  /** Horas del turno previsto (0 si no tenía). */
  plannedHours?: number;
  status: DayStatusKind;
  lastReason?: string;
}
