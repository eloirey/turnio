import { DAY_SHORT, dayOfMonth, weekRangeLabel } from "./dates";
import type { Code, ShiftCatalog } from "./schedule/types";

/** "Mar 13 · 17:00–01:00 (Noche)" por cada día trabajado. */
export function shiftLines(row: Code[], shifts: ShiftCatalog, monday: string): string[] {
  return row.flatMap((c, d) =>
    c === "L" || !shifts[c] ? [] : [`${DAY_SHORT[d]} ${dayOfMonth(monday, d)} · ${shifts[c].start}–${shifts[c].end} (${shifts[c].label})`],
  );
}

export interface ScheduleMessageOptions {
  name: string;
  localName: string;
  monday: string;
  row: Code[];
  shifts: ShiftCatalog;
  link: string;
}

/** Mensaje personal al publicar, con el enlace escrito dentro (WhatsApp, copiar). */
export function personalScheduleMessage(opts: ScheduleMessageOptions): string {
  return `${scheduleIntro(opts)}\n\nLo tienes siempre aquí: ${opts.link}\n(Es tu enlace personal: no lo compartas, con él se ficha a tu nombre.)`;
}

/**
 * Mismo mensaje sin el enlace, para canales que lo adjuntan aparte
 * (Telegram pone el enlace como vista previa, antes o después del texto).
 */
export function personalScheduleMessageNoLink(opts: ScheduleMessageOptions): string {
  return `${scheduleIntro(opts)}\n\nTu horario siempre al día está en el enlace de este mensaje. Es personal: no lo compartas, con él se ficha a tu nombre.`;
}

function scheduleIntro(opts: ScheduleMessageOptions): string {
  const lines = shiftLines(opts.row, opts.shifts, opts.monday);
  const body = lines.length ? lines.join("\n") : "Esta semana libras todos los días.";
  return `Hola ${opts.name}, ya está tu horario de ${opts.localName} (${weekRangeLabel(opts.monday)}):\n\n${body}`;
}

/** Mensaje para mandar el enlace personal desde la ficha de Equipo. */
export function personalLinkMessage(name: string, localName: string, link: string): string {
  return `Hola ${name}, aquí verás siempre tu horario de ${localName} y podrás fichar: ${link}\n\nEs tu enlace personal: no lo compartas con nadie, porque con él se ficha a tu nombre.`;
}

export function personalLinkMessageNoLink(name: string, localName: string): string {
  return `Hola ${name}, en el enlace de este mensaje verás siempre tu horario de ${localName} y podrás fichar.\n\nEs tu enlace personal: no lo compartas con nadie, porque con él se ficha a tu nombre.`;
}

export function groupScheduleMessage(localName: string, monday: string): string {
  return `Ya está publicado el horario de ${localName} para la semana del ${weekRangeLabel(monday)}. Cada uno lo tiene en su enlace personal de Rotafy.`;
}
