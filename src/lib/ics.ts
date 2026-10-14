/**
 * Calendario iCalendar (.ics, RFC 5545) con los turnos de un empleado.
 * Al suscribirse (webcal://…), el calendario del móvil lo vuelve a pedir cada
 * pocas horas: los turnos nuevos aparecen solos al publicar.
 */
import { addDays } from "./dates";

export interface IcsEvent {
  uid: string;
  date: string; // "2026-10-14"
  start: string; // "17:00"
  end: string; // "01:00" (si es menor que start, termina al día siguiente)
  summary: string;
  description?: string;
}

/** Escapa texto según la RFC 5545: \ ; , y saltos de línea. */
export function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Las líneas no deben pasar de 75 octetos: se parten con CRLF + espacio. */
export function foldLine(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let size = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    if (size + n > (parts.length ? 74 : 75)) {
      parts.push(current);
      current = "";
      size = 0;
    }
    current += ch;
    size += n;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const local = (date: string, hhmm: string) => `${date.replace(/-/g, "")}T${hhmm.replace(":", "")}00`;

const MADRID_TZ = [
  "BEGIN:VTIMEZONE",
  "TZID:Europe/Madrid",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0200",
  "TZNAME:CEST",
  "DTSTART:19700329T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0100",
  "TZNAME:CET",
  "DTSTART:19701025T030000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

export function buildIcs(opts: { calendarName: string; events: IcsEvent[]; now?: Date }): string {
  const now = opts.now ?? new Date();
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Rotafy//Turnos//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(opts.calendarName)}`,
    "X-WR-TIMEZONE:Europe/Madrid",
    "REFRESH-INTERVAL;VALUE=DURATION:PT4H",
    "X-PUBLISHED-TTL:PT4H",
    ...MADRID_TZ,
  ];
  for (const e of opts.events) {
    const endDate = e.end <= e.start ? addDays(e.date, 1) : e.date;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART;TZID=Europe/Madrid:${local(e.date, e.start)}`,
      `DTEND;TZID=Europe/Madrid:${local(endDate, e.end)}`,
      `SUMMARY:${escapeText(e.summary)}`,
      ...(e.description ? [`DESCRIPTION:${escapeText(e.description)}`] : []),
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
