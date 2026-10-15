"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ui } from "@/components/ui";
import { activateClock } from "./actions";

const POINTS = [
  ["Sin aplicaciones", "Cada persona ficha desde su enlace personal, el mismo donde ve su horario. Un botón grande para entrar y otro para salir."],
  ["Hora del servidor", "La hora la pone Rotafy, no el móvil: nadie puede adelantarla ni atrasarla."],
  ["Olvidos resueltos", "Si alguien no ficha la salida, lo verás marcado y lo corriges en un momento indicando el motivo."],
  ["Listo para la gestoría", "Horas por persona y día, y el registro del mes en Excel. Cada corrección queda guardada en el historial."],
];

/** Pantalla de Fichajes cuando el local aún no lo ha activado. */
export function ClockIntro({ onActivate }: { onActivate?: () => Promise<void> | void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState(false);

  function activate() {
    start(async () => {
      if (onActivate) return void (await onActivate());
      const res = await activateClock();
      if (!res.ok) return setError(res.error);
      router.refresh();
    });
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-8">
      <div className={`${ui.card} overflow-hidden`}>
        <div className="grid gap-8 p-6 sm:p-10 md:grid-cols-[1.2fr_1fr] md:items-center">
          <div>
            <div className="mb-3 inline-flex rounded-full bg-accent-soft px-3 py-1 text-[13px] font-semibold text-accent-ink">Registro de jornada</div>
            <h1 className="font-display text-[34px] font-bold leading-[1.08] tracking-tight sm:text-[40px]">Que tu equipo fiche desde el móvil, sin instalar nada</h1>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
              Desde 2019 todas las empresas en España tienen que registrar la hora de entrada y salida de cada persona. Con Rotafy lo tienes junto al cuadrante.
            </p>
            {error && <p className={`${ui.error} mt-4`}>{error}</p>}
            <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-xl bg-accent-soft p-3.5 text-[13px] leading-relaxed text-ink-soft">
              <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-0.5 h-4 w-4 flex-none accent-[#1F5C46]" />
              <span>
                <strong className="text-ink">Guardaré una copia del registro cada mes.</strong> La ley pide conservarlo 4 años y con Rotafy es un clic: lo
                descargas en Excel desde aquí.{" "}
                <a href="/legal/aviso-legal" target="_blank" rel="noopener noreferrer" className="font-semibold text-accent underline underline-offset-2">
                  Condiciones
                </a>
              </span>
            </label>
            <button onClick={activate} disabled={pending || !accepted} className={`${ui.btn} ${ui.primary} mt-4 h-12 px-6 text-base`}>
              {pending ? "Activando…" : "Activar el fichaje"}
            </button>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">Puedes desactivarlo cuando quieras en Ajustes.</p>
          </div>
          <div aria-hidden className="mx-auto w-full max-w-[260px] rounded-[30px] border-[7px] border-ink bg-surface p-4 shadow-xl">
            <div className="text-[11px] text-ink-muted">Hola, Laura</div>
            <div className="mt-2 rounded-2xl bg-ink p-4 text-white">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-white/70">
                Fichaje <span className="flex items-center gap-1 text-[#8FD3B0]"><span className="h-1.5 w-1.5 rounded-full bg-[#8FD3B0]" />Trabajando</span>
              </div>
              <div className="mt-1 font-display text-2xl font-bold">3 h 12 min</div>
              <div className="text-[11px] text-white/70">Desde las 16:58</div>
              <div className="mt-3 rounded-xl bg-white py-2.5 text-center text-sm font-bold text-ink">Fichar salida</div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1 text-center text-[10px] text-ink-muted">
              <div className="rounded-lg bg-ground py-1.5">Hoy · 3 h 12</div>
              <div className="rounded-lg bg-ground py-1.5">Semana · 27 h</div>
            </div>
          </div>
        </div>
        <div className="grid gap-px border-t border-line bg-line sm:grid-cols-2">
          {POINTS.map(([t, d]) => (
            <div key={t} className="bg-surface p-5">
              <div className="font-semibold">{t}</div>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">{d}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
