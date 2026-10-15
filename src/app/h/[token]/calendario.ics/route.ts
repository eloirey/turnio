import { addDays } from "@/lib/dates";
import { getEmployeeCalendar } from "@/lib/data/employee-view";
import { buildIcs, type IcsEvent } from "@/lib/ics";

/**
 * Calendario del empleado (.ics). Los móviles se suscriben con webcal:// y lo
 * vuelven a pedir cada pocas horas, así que los turnos publicados aparecen
 * solos en su calendario.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await getEmployeeCalendar(token);
  if (!data) return new Response("Enlace no válido", { status: 404 });

  const { me, weeks, shifts, localName } = data;
  const events: IcsEvent[] = [];
  for (const w of weeks) {
    (w.grid[me.id] ?? []).forEach((code, d) => {
      const s = shifts[code];
      if (code === "L" || !s) return;
      events.push({
        uid: `${w.id}-${me.id}-${d}@rotafy.es`,
        date: addDays(w.monday, d),
        start: s.start,
        end: s.end,
        summary: `${s.label} · ${localName}`,
        description: `Turno «${s.label}» (${s.start}–${s.end}) en ${localName}. Horario publicado con Rotafy.`,
      });
    });
  }

  return new Response(buildIcs({ calendarName: `Turnos · ${localName}`, events }), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="turnos.ics"',
      "Cache-Control": "private, max-age=300",
      "X-Robots-Tag": "noindex",
    },
  });
}
