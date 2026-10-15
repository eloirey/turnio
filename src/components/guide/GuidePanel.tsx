"use client";

import { ui } from "@/components/ui";

export interface GuidePanelProps {
  index: number;
  total: number;
  title: string;
  body: React.ReactNode;
  /** Botón principal (siguiente, ir a la pantalla, crear cuenta…). */
  action: React.ReactNode;
  onHide: () => void;
  onBack?: () => void;
  onSkip?: () => void;
}

/** Tarjeta flotante de la guía paso a paso. La usan la demo y la app. */
export function GuidePanel({ index, total, title, body, action, onHide, onBack, onSkip }: GuidePanelProps) {
  return (
    <aside
      aria-label="Guía paso a paso"
      className="fixed inset-x-3 bottom-3 z-40 rounded-2xl border border-ink/10 bg-ink p-4 text-white shadow-2xl sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[380px] sm:p-5 print:hidden"
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-white/60">
          Guía · {index + 1} de {total}
        </span>
        <button onClick={onHide} className="min-h-9 rounded-lg px-2 text-[13px] text-white/70 hover:bg-white/10 hover:text-white">
          Ocultar
        </button>
      </div>
      <div className="mb-3 h-1 overflow-hidden rounded-full bg-white/15" aria-hidden>
        <div className="h-full rounded-full bg-[#8FD3B0] transition-all" style={{ width: `${((index + 1) / total) * 100}%` }} />
      </div>
      <h2 className="font-display text-lg font-bold sm:text-xl">{title}</h2>
      <div className="mt-1 text-sm leading-relaxed text-white/85 sm:mt-1.5 sm:text-[15px]">{body}</div>
      <div className="mt-3 flex flex-wrap items-center gap-2 sm:mt-4">
        {action}
        <span className="ml-auto flex items-center gap-1">
          {onBack && index > 0 && (
            <button onClick={onBack} className="min-h-9 rounded-lg px-2 text-[13px] text-white/70 hover:bg-white/10 hover:text-white">
              ← Atrás
            </button>
          )}
          {onSkip && (
            <button onClick={onSkip} className="min-h-9 rounded-lg px-2 text-[13px] text-white/70 hover:bg-white/10 hover:text-white">
              Saltar
            </button>
          )}
        </span>
      </div>
    </aside>
  );
}

export const guideBtn = `${ui.btnSm} bg-white text-ink hover:bg-ground`;

export function GuideWaiting() {
  return <span className="text-[13px] text-[#8FD3B0]">Hazlo en la pantalla para seguir ↑</span>;
}

/** Destaca un elemento [data-tour=…] aunque tarde en aparecer (la página puede estar cargando). */
export function highlightTour(name: string): () => void {
  let el: Element | null = null;
  let tries = 0;
  const find = () => {
    el = document.querySelector(`[data-tour="${name}"]`);
    if (el) el.classList.add("tour-pulse");
    return !!el;
  };
  const timer = find()
    ? undefined
    : window.setInterval(() => {
        if (find() || ++tries > 30) window.clearInterval(timer);
      }, 300);
  return () => {
    if (timer) window.clearInterval(timer);
    el?.classList.remove("tour-pulse");
  };
}

/** El cuadrante avisa de lo que pasa para que la guía avance sola. */
export type CuadranteEvent = "generated" | "published" | "edited";
export const CUADRANTE_EVENT = "rotafy:cuadrante";
export function emitCuadranteEvent(event: CuadranteEvent) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(CUADRANTE_EVENT, { detail: event }));
}
