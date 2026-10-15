import { addDays } from "@/lib/dates";
import { getEmployeeCalendar } from "@/lib/data/employee-view";
import { buildIcs, type IcsEvent } from "@/lib/ics";
import { shiftTimes } from "@/lib/schedule/rules";

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
      // Un turno partido son dos eventos (y el segundo puede acabar al día siguiente).
      const tramos: [string, string][] = s.start2 && s.end2 ? [[s.start, s.end], [s.start2, s.end2]] : [[s.start, s.end]];
      tramos.forEach(([start, end], t) => {
        events.push({
          uid: `${w.id}-${me.id}-${d}${t ? "-2" : ""}@rotafy.es`,
          date: addDays(w.monday, d),
          start,
          end,
          summary: `${s.label}${tramos.length > 1 ? (t ? " (2.º tramo)" : " (1.er tramo)") : ""} · ${localName}`,
          description: `Turno «${s.label}» (${shiftTimes(s)}) en ${localName}. Horario publicado con Rotafy.`,
        });
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
