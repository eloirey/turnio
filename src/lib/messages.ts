import { DAY_SHORT, dayOfMonth, weekRangeLabel } from "./dates";
import type { Code, ShiftCatalog } from "./schedule/types";

/** "Mar 13 · 17:00–01:00 (Noche)" por cada día trabajado. */
export function shiftLines(row: Code[], shifts: ShiftCatalog, monday: string): string[] {
  return row.flatMap((c, d) =>
    c === "L" ? [] : [`${DAY_SHORT[d]} ${dayOfMonth(monday, d)} · ${shifts[c].start}–${shifts[c].end} (${shifts[c].label})`],
  );
}

/** Mensaje personal de WhatsApp al publicar. */
export function personalScheduleMessage(opts: {
  name: string;
  localName: string;
  monday: string;
  row: Code[];
  shifts: ShiftCatalog;
  link: string;
}): string {
  const lines = shiftLines(opts.row, opts.shifts, opts.monday);
  const body = lines.length ? lines.join("\n") : "Esta semana libras todos los días.";
  return `Hola ${opts.name}, ya está tu horario de ${opts.localName} (${weekRangeLabel(opts.monday)}):\n\n${body}\n\nLo tienes siempre aquí: ${opts.link}`;
}

export function groupScheduleMessage(localName: string, monday: string): string {
  return `Ya está publicado el horario de ${localName} para la semana del ${weekRangeLabel(monday)}. Cada uno lo tiene en su enlace personal de Rotafy.`;
}
