"use client";

import { useEffect, useState, useTransition } from "react";
import { formatHours, madridDate, madridTime, recordHours, type ClockRecord } from "@/lib/fichajes";
import type { Position } from "@/lib/clock-place";
import { punchClock } from "./actions";

interface Props {
  token: string;
  /** Tramos de esta semana (y el abierto, si lo hay). */
  records: ClockRecord[];
  /** Hora del servidor al pintar la página. */
  now: string;
  today: string;
  /** "Noche · 17:00–01:00" si hoy tiene turno. */
  todayShift: string | null;
  /** Si el local comprueba desde dónde se ficha (y si hoy teletrabaja). */
  place?: { checks: boolean; remoteToday: boolean };
}

/** Pide la ubicación al móvil (solo para comprobar que está en el local). */
function currentPosition(): Promise<Position | null> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  });
}

/** Botón grande para fichar entrada y salida desde el móvil. */
export function ClockCard({ token, records: initial, now: serverNow, today, todayShift, place }: Props) {
  const askLocation = Boolean(place?.checks && !place.remoteToday);
  const [records, setRecords] = useState(initial);
  const [now, setNow] = useState(() => new Date(serverNow));
  const [confirmOut, setConfirmOut] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: "ok" | "warn" | "error" } | null>(null);
  const [pending, start] = useTransition();

  // El contador avanza solo mientras está dentro.
  const open = records.find((r) => !r.end && !r.missingEnd) ?? null;
  useEffect(() => {
    if (!open) return;
    const tick = () => setNow(new Date());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 15_000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [open]);

  // Si pide confirmar la salida y no toca, el botón vuelve a su estado al rato.
  useEffect(() => {
    if (!confirmOut) return;
    const t = setTimeout(() => setConfirmOut(false), 4000);
    return () => clearTimeout(t);
  }, [confirmOut]);

  const todayRecords = records.filter((r) => madridDate(r.start) === today);
  const todayHours = todayRecords.reduce((a, r) => a + recordHours(r, now), 0);
  const weekHours = records.reduce((a, r) => a + recordHours(r, now), 0);
  const forgot = records.find((r) => r.missingEnd);

  function punch() {
    if (open && !confirmOut) return setConfirmOut(true);
    setConfirmOut(false);
    start(async () => {
      const position = askLocation ? await currentPosition() : null;
      const res = await punchClock(token, position);
      if (!res.ok) return setMessage({ text: res.error, tone: "error" });
      const at = new Date();
      if (res.estado === "dentro") {
        const start = res.desde ?? at.toISOString();
        setRecords((rs) => {
          const closed = res.olvidado ? rs.map((r) => (!r.end && !r.missingEnd ? { ...r, missingEnd: true } : r)) : rs;
          return closed.some((r) => r.start === start) ? closed : [...closed, { id: `local-${start}`, employeeId: "", start, end: null, missingEnd: false, edited: false }];
        });
        setMessage(
          res.olvidado
            ? { text: `Entrada registrada a las ${madridTime(start)}. La última vez no fichaste la salida: tu encargado lo revisará.`, tone: "warn" }
            : res.place === "fuera"
              ? { text: `Entrada registrada a las ${madridTime(start)}, pero fuera del local: tu encargado lo verá.`, tone: "warn" }
              : { text: `Entrada registrada a las ${madridTime(start)}. ¡Buen turno!`, tone: "ok" },
        );
      } else {
        const end = res.hasta ?? at.toISOString();
        setRecords((rs) => rs.map((r) => (!r.end && !r.missingEnd ? { ...r, end } : r)));
        setMessage(
          res.place === "fuera"
            ? { text: `Salida registrada a las ${madridTime(end)}, pero fuera del local: tu encargado lo verá.`, tone: "warn" }
            : { text: `Salida registrada a las ${madridTime(end)}. ¡Hasta la próxima!`, tone: "ok" },
        );
      }
      setNow(new Date());
    });
  }

  return (
    <section aria-label="Fichar" className={`overflow-hidden rounded-[20px] ${open ? "bg-ink text-white" : "border border-line bg-surface"}`}>
      <div className="p-5">
        <div className="flex items-center justify-between gap-3">
          <span className={`text-[13px] font-medium uppercase tracking-[0.08em] ${open ? "text-white/70" : "text-ink-muted"}`}>Fichaje</span>
          {open && (
            <span className="flex items-center gap-1.5 text-[13px] font-semibold text-[#8FD3B0]">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#8FD3B0]" />
              Trabajando
            </span>
          )}
        </div>

        {open ? (
          <div className="mt-2">
            <div className="font-display text-[40px] font-bold leading-none tracking-tight tabular-nums">{formatHours(recordHours(open, now))}</div>
            <div className="mt-2 text-[15px] text-white/80">Desde las {madridTime(open.start)}</div>
          </div>
        ) : (
          <div className="mt-2">
            <div className="font-display text-[26px] font-bold leading-tight">{todayRecords.length ? "Fuera de turno" : "Aún no has fichado hoy"}</div>
            <div className="mt-1 text-[15px] text-ink-soft">{todayShift ? `Hoy te toca: ${todayShift}` : "Hoy no tienes turno en el cuadrante."}</div>
          </div>
        )}

        <button
          type="button"
          onClick={punch}
          disabled={pending}
          className={`mt-5 flex h-16 w-full items-center justify-center rounded-2xl text-lg font-bold transition active:scale-[0.99] disabled:opacity-60 ${
            open ? (confirmOut ? "bg-danger text-white" : "bg-white text-ink") : "bg-accent text-white hover:bg-accent-ink"
          }`}
        >
          {pending ? "Un momento…" : open ? (confirmOut ? "Toca otra vez para salir" : "Fichar salida") : "Fichar entrada"}
        </button>

        {message && (
          <p
            role="status"
            className={`mt-3 rounded-xl px-3 py-2 text-sm ${
              message.tone === "error" ? "bg-danger-soft text-danger-ink" : message.tone === "warn" ? "bg-pending-soft text-pending-ink" : open ? "bg-white/10 text-white" : "bg-ok-soft text-accent"
            }`}
          >
            {message.text}
          </p>
        )}
        {place?.checks && (
          <p className={`mt-3 text-[13px] leading-snug ${open ? "text-white/70" : "text-ink-muted"}`}>
            {place.remoteToday ? "🏠 Hoy teletrabajas: puedes fichar desde cualquier sitio." : "📍 Al fichar se comprueba que estás en el local. Tu ubicación no se guarda."}
          </p>
        )}
        {!message && forgot && (
          <p className={`mt-3 rounded-xl px-3 py-2 text-sm ${open ? "bg-white/10 text-white" : "bg-pending-soft text-pending-ink"}`}>
            El {madridDate(forgot.start).split("-").reverse().slice(0, 2).join("/")} no fichaste la salida. Tu encargado lo corregirá.
          </p>
        )}
      </div>

      <div className={`grid grid-cols-2 border-t text-center ${open ? "border-white/15" : "border-line"}`}>
        <div className="px-3 py-3">
          <div className={`text-xs ${open ? "text-white/60" : "text-ink-muted"}`}>Hoy</div>
          <div className="font-semibold tabular-nums">{formatHours(todayHours)}</div>
        </div>
        <div className={`border-l px-3 py-3 ${open ? "border-white/15" : "border-line"}`}>
          <div className={`text-xs ${open ? "text-white/60" : "text-ink-muted"}`}>Esta semana</div>
          <div className="font-semibold tabular-nums">{formatHours(weekHours)}</div>
        </div>
      </div>
    </section>
  );
}
