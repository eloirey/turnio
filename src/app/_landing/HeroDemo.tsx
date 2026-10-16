"use client";

import { memo, useEffect, useRef, useState } from "react";
import { PALETTE } from "@/lib/roles";

/*
 * «Vídeo» de la portada: una semana en un bar contada en 42 segundos, con el
 * encargado (ordenador) y una empleada (móvil). No es un vídeo de verdad: es
 * la propia interfaz animada, así se ve nítida, pesa poco y se puede pausar.
 *
 * Todo se deriva del tiempo `t` (ms): cada elemento mira en qué momento
 * estamos y se pinta como toca. Las posiciones son de un escenario fijo de
 * 790×540 px que luego se escala al ancho disponible.
 */

export const TOTAL = 42_000;
const START = 600;
export const CHAPTERS = [
  { start: 0, title: "Genera la semana", text: "Lunes, 10:00. Un clic y Rotafy reparte los turnos respetando descansos y contratos." },
  { start: 7_000, title: "Publica y avisa", text: "Cada persona recibe su horario en el móvil. Sin fotos en el grupo." },
  { start: 13_000, title: "Fichan desde el móvil", text: "Miércoles, 16:58. Laura ficha al llegar y tú lo ves al momento." },
  { start: 20_000, title: "Cambios sin mensajes a deshoras", text: "Laura pide librar el viernes. Aceptas con un toque y Pol cubre su turno." },
  { start: 28_000, title: "Olvidos resueltos", text: "Jordi no fichó la salida. Lo corriges y queda guardado el motivo." },
  { start: 35_000, title: "El registro, en Excel", text: "A fin de mes, un clic y se lo mandas a la gestoría." },
] as const;

export const W = 790;
export const H = 540;
/** El ordenador del encargado y el móvil de Laura, en el escenario. */
const WIN = { x: 0, y: 28 };
const PHONE = { x: 578, y: 116, w: 200, h: 404 };
const SCREEN = { x: PHONE.x + 7, y: PHONE.y + 7 };

// ---------- Datos de la semana ----------
type Code = "M" | "T" | "N" | null;
const SHIFT: Record<"M" | "T" | "N", { t: string; label: string }> = {
  M: { t: "09–17", label: "Mañana" },
  T: { t: "13–21", label: "Tarde" },
  N: { t: "17–01", label: "Noche" },
};
const DAYS = ["Lun 12", "Mar 13", "Mié 14", "Jue 15", "Vie 16", "Sáb 17", "Dom 18"];
const PEOPLE = [
  { name: "Marta", role: "Sala", color: 0, week: ["M", "M", "M", "M", "M", null, null] },
  { name: "Jordi", role: "Cocina", color: 1, week: ["N", "N", "N", null, null, "N", "M"] },
  { name: "Laura", role: "Barra", color: 2, week: [null, "N", "N", null, "N", "T", null] },
  { name: "Aleix", role: "Sala", color: 0, week: [null, "T", null, "T", "N", "T", "M"] },
  { name: "Pol", role: "Barra", color: 2, week: ["T", "T", null, "N", null, null, "N"] },
] as { name: string; role: string; color: number; week: Code[] }[];

// Geometría del cuadrante dentro de la ventana (coincide con lo que se pinta).
const GRID = { top: 150, rowH: 46, nameW: 70, left: 16, colW: 66, gap: 4 };
const cellX = (d: number) => GRID.left + GRID.nameW + d * (GRID.colW + GRID.gap);
const cellY = (r: number) => GRID.top + r * GRID.rowH;
const cellCenter = (r: number, d: number) => ({ x: WIN.x + cellX(d) + GRID.colW / 2, y: WIN.y + cellY(r) + (GRID.rowH - 4) / 2 });

// Botones y elementos donde «pulsa» el cursor (coordenadas del escenario).
/** Botones de arriba a la derecha (dentro de la ventana). */
const GEN = { left: 290, w: 162 };
const PUB = { left: 458, w: 120 };
const BTN_TOP = 18; // dentro de la vista, debajo de la cabecera
const BTN_GENERATE = { x: WIN.x + GEN.left + GEN.w / 2, y: WIN.y + 64 + BTN_TOP + 16 };
const BTN_PUBLISH = { x: WIN.x + PUB.left + PUB.w / 2, y: WIN.y + 64 + BTN_TOP + 16 };
const TAB_CLOCK = { x: WIN.x + 212, y: WIN.y + 46 };
const POP = { x: 330, y: 200 }; // menú de una casilla (dentro de la ventana)
const OPT_NIGHT = { x: WIN.x + POP.x + 50, y: WIN.y + POP.y + 92 };
const NOTE = { x: 296, y: 50 }; // aviso de la solicitud (escenario)
const BTN_ACCEPT = { x: NOTE.x + 86, y: NOTE.y + 82 };
const EDITOR = { x: 214, y: 146 }; // editor de fichaje (ventana)
const BTN_SAVE = { x: WIN.x + EDITOR.x + 218, y: WIN.y + EDITOR.y + 166 };
const DIALOG = { x: 150, y: 116 }; // exportar (ventana)
const BTN_DOWNLOAD = { x: WIN.x + DIALOG.x + 224, y: WIN.y + DIALOG.y + 192 };

// En el móvil (coordenadas del escenario).
const TAP_NOTIF = { x: SCREEN.x + 93, y: SCREEN.y + 132 };
const TAP_CLOCK = { x: SCREEN.x + 93, y: SCREEN.y + 217 };
const TAP_REQUEST = { x: SCREEN.x + 93, y: SCREEN.y + 323 };
const TAP_SEND = { x: SCREEN.x + 93, y: SCREEN.y + 302 };

// ---------- Guion ----------
/** Recorrido del cursor del encargado: [ms, x, y]. Entre puntos se mueve suave. */
const CURSOR: [number, number, number][] = [
  [0, 430, 330],
  [300, 430, 330],
  [1_000, BTN_GENERATE.x, BTN_GENERATE.y],
  [3_300, BTN_GENERATE.x, BTN_GENERATE.y],
  [4_100, cellCenter(4, 5).x, cellCenter(4, 5).y],
  [4_500, cellCenter(4, 5).x, cellCenter(4, 5).y],
  [5_000, OPT_NIGHT.x, OPT_NIGHT.y],
  [7_200, OPT_NIGHT.x, OPT_NIGHT.y],
  [7_900, BTN_PUBLISH.x, BTN_PUBLISH.y],
  [10_000, BTN_PUBLISH.x, BTN_PUBLISH.y],
  [11_000, 300, 330],
  [23_600, 300, 330],
  [24_600, BTN_ACCEPT.x, BTN_ACCEPT.y],
  [27_800, BTN_ACCEPT.x, BTN_ACCEPT.y],
  [28_600, TAB_CLOCK.x, TAB_CLOCK.y],
  [29_000, TAB_CLOCK.x, TAB_CLOCK.y],
  [29_800, cellCenter(1, 1).x, cellCenter(1, 1).y],
  [30_100, cellCenter(1, 1).x, cellCenter(1, 1).y],
  [31_700, BTN_SAVE.x, BTN_SAVE.y],
  [32_700, BTN_SAVE.x, BTN_SAVE.y],
  [33_600, 400, 320],
  [35_000, 400, 320],
  [35_700, BTN_PUBLISH.x, BTN_PUBLISH.y],
  [36_000, BTN_PUBLISH.x, BTN_PUBLISH.y],
  [36_800, BTN_DOWNLOAD.x, BTN_DOWNLOAD.y],
  [37_400, BTN_DOWNLOAD.x, BTN_DOWNLOAD.y],
  [38_400, 300, 400],
  [TOTAL, 430, 330],
];
export const CLICKS = [1_100, 4_400, 5_100, 8_000, 24_700, 28_800, 30_000, 32_400, 35_800, 37_000];
export const TAPS: [number, { x: number; y: number }][] = [
  [10_000, TAP_NOTIF],
  [14_500, TAP_CLOCK],
  [20_700, TAP_REQUEST],
  [22_700, TAP_SEND],
];

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const ease = (p: number) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);
export const prog = (t: number, a: number, b: number) => clamp((t - a) / (b - a));

function cursorAt(t: number) {
  let i = CURSOR.findIndex(([ms]) => ms > t);
  if (i <= 0) i = i === 0 ? 1 : CURSOR.length - 1;
  const [t0, x0, y0] = CURSOR[i - 1];
  const [t1, x1, y1] = CURSOR[i];
  const p = ease(prog(t, t0, t1));
  return { x: x0 + (x1 - x0) * p, y: y0 + (y1 - y0) * p };
}

/** Entrada suave de un elemento que aparece en `at` (todo depende de `t`, así se puede parar en cualquier momento). */
const appear = (t: number, at: number, dy = 8): React.CSSProperties => {
  const p = ease(prog(t, at, at + 240));
  return { opacity: p, transform: `translateY(${(1 - p) * dy}px)` };
};

/** Texto que se escribe letra a letra. */
const typed = (t: number, a: number, b: number, s: string) => s.slice(0, Math.round(prog(t, a, b) * s.length));

/** Lo que muestra el cuadrante en cada momento. */
function scheduleAt(t: number): Code[][] {
  return PEOPLE.map((p, r) =>
    p.week.map((c, d) => {
      if (t < 7_000) {
        // Se va rellenando al generar; el sábado de Pol, cuando se elige «Noche».
        if (r === 4 && d === 5) return t >= 5_100 ? "N" : null;
        const order = r * 7 + d;
        return t >= 1_300 + order * 30 ? c : null;
      }
      if (r === 4 && d === 5) return "N";
      if (t >= 25_000 && r === 2 && d === 4) return null; // Laura libra el viernes
      if (t >= 25_700 && r === 4 && d === 4) return "N"; // y Pol lo cubre
      return c;
    }),
  );
}

/** Cuándo se acaba de rellenar una casilla (para que entre con un pequeño «pop»). */
function fillAt(r: number, d: number, t: number): number | null {
  if (r === 4 && d === 5) return t < 7_000 ? 5_100 : null;
  if (r === 4 && d === 4 && t >= 25_700) return 25_700;
  if (t < 7_000) return 1_300 + (r * 7 + d) * 30;
  return null;
}

// ---------- Componente ----------

export function HeroDemo() {
  // Empieza un poco después del 0 para que el primer fotograma no sea el fundido del bucle.
  const [t, setT] = useState(START);
  const [playing, setPlaying] = useState(true);
  const [reduced, setReduced] = useState(false);
  const [visible, setVisible] = useState(true);
  const [scale, setScale] = useState(1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const tRef = useRef(START);
  const overlayRef = useRef<HTMLDivElement>(null);
  // Empieza cuando la página ya ha cargado (no compite con lo importante).
  const [ready, setReady] = useState(false);

  // Escala del escenario al ancho disponible.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setScale(Math.min(1, e.contentRect.width / W)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Sin movimiento si el sistema lo pide: se queda en un momento y se avanza a mano.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      setReduced(mq.matches);
      // «#demo=18500» abre la animación parada en ese momento (para enlazar o revisar una parte).
      const hash = window.location.hash.match(/demo=(\d+)/);
      const at = hash ? Math.min(TOTAL - 1, Number(hash[1])) : mq.matches ? 18_500 : null;
      if (at !== null) {
        setPlaying(false);
        tRef.current = at;
        setT(at);
      }
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Solo se mueve si se ve (ahorra batería).
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => setReady(true), 1_200);
    return () => window.clearTimeout(id);
  }, []);

  // Cursor y toques siempre al día, también al pausar o saltar a otra parte.
  useEffect(() => paintOverlay(overlayRef.current, t), [t]);

  useEffect(() => {
    if (!playing || !visible || !ready) return;
    let raf = 0;
    let last = performance.now();
    let lastPaint = 0;
    const loop = (now: number) => {
      tRef.current = (tRef.current + Math.min(now - last, 100)) % TOTAL;
      last = now;
      paintOverlay(overlayRef.current, tRef.current);
      if (now - lastPaint > 50) {
        lastPaint = now;
        setT(tRef.current);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, visible, ready]);

  const chapter = CHAPTERS.reduce((acc, c, i) => (t >= c.start ? i : acc), 0);
  const goTo = (i: number) => {
    const at = reduced ? (CHAPTERS[i + 1]?.start ?? TOTAL) - 1_500 : CHAPTERS[i].start;
    tRef.current = at;
    setT(at);
  };

  return (
    <div className="relative">
      <div
        ref={wrapRef}
        className="relative w-full"
        style={{ height: H * scale }}
        role="img"
        aria-label="Animación de Rotafy: el encargado genera y publica el cuadrante, Laura recibe su horario y ficha desde el móvil, pide librar y el encargado lo acepta, se corrige un olvido de fichaje y se descarga el registro en Excel."
      >
        <div className="absolute left-0 top-0 origin-top-left select-none" style={{ width: W, height: H, transform: `scale(${scale})` }} aria-hidden>
          <Content t={t} />
          <Overlay overlayRef={overlayRef} />
        </div>
      </div>

      {/* Capítulos: como la barra de un vídeo, pero se puede saltar a cada parte */}
      <div className="mt-5 flex items-start gap-3">
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? "Pausar la animación" : "Reproducir la animación"}
          className="flex h-10 w-10 flex-none items-center justify-center rounded-full border border-line-strong bg-surface text-ink shadow-sm transition hover:border-ink active:scale-95"
        >
          {playing ? (
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden>
              <rect x="5" y="4" width="3.5" height="12" rx="1" />
              <rect x="11.5" y="4" width="3.5" height="12" rx="1" />
            </svg>
          ) : (
            <svg viewBox="0 0 20 20" className="ml-0.5 h-4 w-4" fill="currentColor" aria-hidden>
              <path d="M6 4.5v11a1 1 0 001.5.86l9-5.5a1 1 0 000-1.72l-9-5.5A1 1 0 006 4.5z" />
            </svg>
          )}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex gap-1.5" role="group" aria-label="Partes de la animación">
            {CHAPTERS.map((c, i) => {
              const end = CHAPTERS[i + 1]?.start ?? TOTAL;
              const fill = i < chapter ? 1 : i > chapter ? 0 : prog(t, c.start, end);
              return (
                <button key={c.title} type="button" onClick={() => goTo(i)} aria-label={`${i + 1}. ${c.title}`} aria-current={i === chapter} className="group flex-1 py-2">
                  <span className="block h-1.5 overflow-hidden rounded-full bg-line-strong/70 transition group-hover:bg-line-strong">
                    <span className="block h-full rounded-full bg-accent" style={{ width: `${fill * 100}%` }} />
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-1 min-h-[44px]" aria-live="polite">
            <div key={chapter} className="anim-pop">
              <span className="text-[15px] font-semibold text-ink">
                {chapter + 1}. {CHAPTERS[chapter].title}
              </span>{" "}
              <span className="text-[14px] text-ink-soft">{CHAPTERS[chapter].text}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Escenario ----------

/**
 * Lo que va encima (cursor, toques en el móvil y el fundido del bucle) se mueve
 * en cada fotograma tocando el DOM directamente; el resto se repinta con React
 * unas 20 veces por segundo. Así la animación es fluida y gasta poco.
 */
export function Overlay({ overlayRef }: { overlayRef: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div ref={overlayRef} className="pointer-events-none absolute inset-0 z-30">
      <span data-k="tap" className="absolute rounded-full border-2 border-white bg-ink/25" style={{ width: 36, height: 36, opacity: 0 }} />
      <div data-k="cursor" className="absolute">
        <span data-k="ripple" className="absolute rounded-full bg-accent/30" style={{ left: -13, top: -14, width: 32, height: 32, opacity: 0 }} />
        <svg width="22" height="26" viewBox="0 0 22 26" className="drop-shadow-[0_2px_3px_rgba(0,0,0,0.3)]">
          <path d="M2 2l16 11.5-7 1.3 4.2 8.2-3.3 1.6-4.2-8.3L2 21z" fill="#1B1B1A" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      </div>
      <div data-k="fade" className="absolute inset-0 bg-ground" style={{ opacity: 0 }} />
    </div>
  );
}

export function paintOverlay(root: HTMLDivElement | null, t: number) {
  if (!root) return;
  const q = (k: string) => root.querySelector<HTMLElement>(`[data-k="${k}"]`)!;
  const cur = cursorAt(t);
  const clicking = CLICKS.find((c) => t >= c && t < c + 380);
  const cursor = q("cursor");
  cursor.style.left = `${cur.x - 3}px`;
  cursor.style.top = `${cur.y - 2}px`;
  cursor.style.scale = clicking !== undefined ? "0.85" : "1";
  const ripple = q("ripple");
  ripple.style.opacity = clicking !== undefined ? String(1 - prog(t, clicking, clicking + 380)) : "0";
  ripple.style.transform = clicking !== undefined ? `scale(${0.4 + prog(t, clicking, clicking + 380)})` : "";
  const tap = TAPS.find(([ms]) => t >= ms && t < ms + 500);
  const tapEl = q("tap");
  if (tap) {
    tapEl.style.left = `${tap[1].x - 18}px`;
    tapEl.style.top = `${tap[1].y - 18}px`;
    tapEl.style.transform = `scale(${0.6 + prog(t, tap[0], tap[0] + 500) * 0.8})`;
    tapEl.style.opacity = String(1 - prog(t, tap[0] + 200, tap[0] + 500));
  } else tapEl.style.opacity = "0";
  // Fundido al final para que el bucle no dé un salto.
  q("fade").style.opacity = String(prog(t, TOTAL - 700, TOTAL) + (1 - prog(t, 0, 500)));
}

export const Content = memo(function Content({ t }: { t: number }) {
  return (
    <div className="relative h-full w-full font-sans text-ink">
      <ManagerWindow t={t} />
      <RequestNote t={t} />
      <Phone t={t} />
    </div>
  );
});

// ---------- Ordenador del encargado ----------

function ManagerWindow({ t }: { t: number }) {
  const clockMode = t >= 28_900; // pestaña Fichajes
  const clockFade = ease(prog(t, 28_900, 29_200));
  const unread = t >= 23_400 && t < 24_800 ? 1 : 0;
  return (
    <div className="absolute overflow-hidden rounded-[22px] border border-line bg-surface shadow-[0_40px_80px_-40px_rgba(27,27,26,0.5)]" style={{ left: WIN.x, top: WIN.y, width: 590, height: 452 }}>
      {/* Barra del navegador */}
      <div className="flex h-7 items-center gap-1.5 bg-ground px-3">
        <span className="h-2 w-2 rounded-full bg-[#E4E1D8]" />
        <span className="h-2 w-2 rounded-full bg-[#E4E1D8]" />
        <span className="h-2 w-2 rounded-full bg-[#E4E1D8]" />
        <span className="ml-3 rounded bg-surface px-2.5 py-0.5 text-[10px] text-ink-muted">rotafy.es/app/{clockMode ? "fichajes" : "cuadrante"}</span>
      </div>
      {/* Cabecera de la app */}
      <div className="flex h-9 items-center gap-1 border-b border-line px-4 text-[12px]">
        <span className="mr-3 flex items-center gap-1.5 font-display text-[14px] font-bold">
          <Mark size={18} /> rotafy
        </span>
        <span className={`rounded-md px-2.5 py-1 font-semibold ${clockMode ? "text-ink-muted" : "bg-accent-soft text-accent-ink"}`}>Cuadrante</span>
        <span className={`rounded-md px-2.5 py-1 font-semibold ${clockMode ? "bg-accent-soft text-accent-ink" : "text-ink-muted"}`}>Fichajes</span>
        <span className="rounded-md px-2.5 py-1 font-semibold text-ink-muted">Equipo</span>
        <span className="ml-auto text-[11px] text-ink-muted">Bar Central</span>
        <span className={`relative ml-3 flex h-7 w-7 items-center justify-center rounded-full ${unread ? "bg-pending-soft" : ""}`}>
          <Bell />
          {unread > 0 && <span style={appear(t, 23_400, -4)} className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[9px] font-bold text-white">1</span>}
        </span>
      </div>

      <div className="relative" style={{ height: 452 - 64 }}>
        <div className="absolute inset-0" style={{ opacity: 1 - clockFade }}>
          <ScheduleView t={t} />
        </div>
        <div className="absolute inset-0" style={{ opacity: clockFade }}>
          {t >= 28_000 && <ClockView t={t} />}
        </div>
      </div>
    </div>
  );
}

function ScheduleView({ t }: { t: number }) {
  const grid = scheduleAt(t);
  const generated = t >= 1_300;
  const missingSat = generated && t < 5_100 && t < 7_000;
  const published = t >= 8_000 && t < TOTAL;
  const changed = t >= 25_000;
  const popOpen = t >= 4_400 && t < 5_150;
  // Fichajes reales debajo de los turnos, una vez pasados esos días.
  const clockOn = t >= 13_000;
  const chips: Record<string, { text: string; cls: string }> = clockOn
    ? {
        "0-0": { text: "✓ 08:57–17:02", cls: "bg-white/80 text-accent" },
        "0-1": { text: "✓ 08:59–17:00", cls: "bg-white/80 text-accent" },
        "1-0": { text: "Tarde +12′", cls: "bg-[#FFD9A8] text-[#7A3E00]" },
        "2-1": { text: "✓ 16:55–01:03", cls: "bg-white/80 text-accent" },
        "3-1": { text: "✓ 12:58–21:04", cls: "bg-white/80 text-accent" },
        ...(t >= 16_100 ? { "2-2": { text: "● 16:58", cls: "bg-ok-soft text-accent" } } : {}),
        ...(t >= 16_100 ? { "0-2": { text: "✓ 08:58–17:01", cls: "bg-white/80 text-accent" } } : {}),
      }
    : {};
  const pulse = (r: number, d: number) =>
    (r === 2 && d === 2 && t >= 16_100 && t < 17_600) || (r === 4 && d === 4 && t >= 25_700 && t < 27_200) || (r === 4 && d === 5 && t >= 5_100 && t < 6_400);
  const status = published ? (changed && t < 27_900 ? "cambios" : "publicado") : "borrador";

  return (
    <div className="relative h-full px-4">
      <div className="flex items-start justify-between pt-3">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
            Semana 42
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] normal-case tracking-normal ${status === "borrador" ? "bg-ground text-ink-soft" : status === "cambios" ? "bg-pending-soft text-pending-ink" : "bg-ok-soft text-accent"}`}
            >
              {status === "borrador" ? "Borrador" : status === "cambios" ? "Cambios sin publicar" : "Publicado"}
            </span>
          </div>
          <div className="font-display text-[22px] font-bold leading-tight">12 – 18 octubre</div>
        </div>
      </div>
      {/* Botones */}
      <span
        className={`absolute flex h-8 items-center justify-center rounded-lg border border-line-strong bg-surface text-[12px] font-semibold transition ${t >= 1_100 && t < 1_450 ? "scale-95" : ""}`}
        style={{ left: GEN.left, width: GEN.w, top: BTN_TOP }}
      >
        Generar automáticamente
      </span>
      <span
        className={`absolute flex h-8 items-center justify-center rounded-lg text-[12px] font-semibold text-white transition ${published && !(changed && t < 27_900) ? "bg-accent/60" : "bg-accent"} ${t >= 8_000 && t < 8_350 ? "scale-95" : ""}`}
        style={{ left: PUB.left, width: PUB.w, top: BTN_TOP }}
      >
        {published && !(changed && t < 27_900) ? "Publicado ✓" : changed && t < 27_900 ? "Publicar cambios" : "Publicar y avisar"}
      </span>

      {/* Días */}
      {DAYS.map((d, i) => (
        <span key={d} className="absolute text-center text-[10px] font-semibold text-ink-muted" style={{ left: cellX(i), top: GRID.top - 64 - 18, width: GRID.colW }}>
          {d}
        </span>
      ))}
      {/* Filas */}
      {PEOPLE.map((p, r) => (
        <div key={p.name}>
          <span className="absolute leading-tight" style={{ left: GRID.left, top: cellY(r) - 64 + 8 }}>
            <span className="block text-[12px] font-semibold">{p.name}</span>
            <span className="block text-[10px] text-ink-muted">{p.role}</span>
          </span>
          {grid[r].map((c, d) => {
            const chip = chips[`${r}-${d}`];
            const missing = missingSat && r === 4 && d === 5 && t >= 2_600;
            const at = fillAt(r, d, t);
            const pop = at === null ? 1 : ease(prog(t, at, at + 260));
            return (
              <span
                key={d}
                className={`absolute flex flex-col justify-center rounded-lg px-1.5 ${c ? "" : missing ? "border-2 border-dashed border-danger/60 bg-danger-soft" : "border border-dashed border-[#D6D2C7]"} ${pulse(r, d) ? "ring-2 ring-accent ring-offset-1" : ""}`}
                style={{
                  left: cellX(d),
                  top: cellY(r) - 64,
                  width: GRID.colW,
                  height: GRID.rowH - 4,
                  ...(c ? { backgroundColor: PALETTE[p.color].bg, color: PALETTE[p.color].fg } : {}),
                  ...(c && pop < 1 ? { opacity: 0.35 + 0.65 * pop, transform: `scale(${0.9 + 0.1 * pop})` } : {}),
                }}
              >
                {c ? (
                  <>
                    <span className="text-[11px] font-bold leading-tight">{SHIFT[c].t} h</span>
                    {chip ? (
                      <span className={`mt-0.5 w-fit max-w-full truncate rounded px-1 text-[8.5px] font-semibold leading-[13px] ${chip.cls}`}>{chip.text}</span>
                    ) : (
                      <span className="text-[9.5px] opacity-75">{SHIFT[c].label}</span>
                    )}
                  </>
                ) : (
                  <span className={`text-[10px] ${missing ? "font-semibold text-danger-ink" : "text-[#A9A59B]"}`}>{missing ? "Falta 1" : "Libre"}</span>
                )}
              </span>
            );
          })}
        </div>
      ))}

      {/* Revisión */}
      <div className="absolute flex items-center gap-2" style={{ left: GRID.left, top: cellY(5) - 64 + 6, right: 16 }}>
        {!generated ? (
          <Banner tone="muted">Pulsa «Generar» y Rotafy reparte la semana.</Banner>
        ) : missingSat && t >= 2_600 ? (
          <Banner tone="bad">Sábado noche: falta 1 en barra</Banner>
        ) : t >= 25_000 && t < 25_700 ? (
          <Banner tone="bad">Viernes noche: falta 1 en barra</Banner>
        ) : (
          <Banner tone="ok">Todo cubierto · descansos y días libres en regla</Banner>
        )}
      </div>

      {/* Menú de la casilla */}
      {popOpen && (
        <div className="absolute z-10 rounded-xl border border-line bg-surface p-2.5 shadow-xl" style={{ left: POP.x, top: POP.y - 64, width: 200, ...appear(t, 4_400, -6) }}>
          <div className="mb-1.5 px-1 text-[11px] font-semibold">Pol · sábado 17</div>
          <div className="grid grid-cols-2 gap-1.5">
            {(["M", "T", "N"] as const).map((k) => (
              <span key={k} className={`rounded-lg border px-2 py-1.5 text-[11px] ${k === "N" && t >= 4_900 ? "border-ink bg-ground" : "border-line"}`}>
                <b className="block text-[11px]">{SHIFT[k].label}</b>
                <span className="text-[9.5px] text-ink-muted">{SHIFT[k].t}</span>
              </span>
            ))}
            <span className="rounded-lg border border-line px-2 py-1.5 text-[11px]">
              <b className="block text-[11px]">Libre</b>
              <span className="text-[9.5px] text-ink-muted">No trabaja</span>
            </span>
          </div>
        </div>
      )}

      {/* Aviso «Publicado» */}
      {t >= 8_100 && t < 10_800 && (
        <div style={appear(t, 8_100, 12)} className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-xl bg-ink px-4 py-2.5 text-[12px] font-medium text-white shadow-lg">
          Publicado. Avisando a 5 personas en su móvil…
        </div>
      )}
      {t >= 25_100 && t < 27_400 && (
        <div style={appear(t, 25_100, 12)} className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-xl bg-ink px-4 py-2.5 text-[12px] font-medium text-white shadow-lg">
          Cambio aplicado. Pol cubre el viernes noche.
        </div>
      )}
    </div>
  );
}

function ClockView({ t }: { t: number }) {
  const editing = t >= 30_100 && t < 32_500;
  const fixed = t >= 32_500;
  const dialog = t >= 35_900 && t < 37_100;
  const downloaded = t >= 37_100;
  const hours = [
    ["8:05", "8:01", "8:03", "", "", "", ""],
    ["8:12", fixed ? "8:03" : "0:00", "", "", "", "", ""],
    ["", "8:08", "8:00", "", "", "", ""],
    ["", "8:06", "", "", "", "", ""],
    ["7:58", "8:02", "", "", "", "", ""],
  ];
  return (
    <div className="relative h-full px-4">
      <div className="pt-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Registro de jornada</div>
        <div className="font-display text-[22px] font-bold leading-tight">12 – 18 octubre</div>
      </div>
      <span
        className={`absolute flex h-8 items-center justify-center rounded-lg border border-line-strong bg-surface text-[12px] font-semibold transition ${t >= 35_800 && t < 36_150 ? "scale-95" : ""}`}
        style={{ left: PUB.left, width: PUB.w, top: BTN_TOP }}
      >
        Exportar registro…
      </span>
      {DAYS.map((d, i) => (
        <span key={d} className="absolute text-center text-[10px] font-semibold text-ink-muted" style={{ left: cellX(i), top: GRID.top - 64 - 18, width: GRID.colW }}>
          {d}
        </span>
      ))}
      {PEOPLE.map((p, r) => (
        <div key={p.name}>
          <span className="absolute text-[12px] font-semibold" style={{ left: GRID.left, top: cellY(r) - 64 + 13 }}>
            {p.name}
          </span>
          {hours[r].map((h, d) => {
            const forgot = r === 1 && d === 1 && !fixed;
            const justFixed = r === 1 && d === 1 && fixed;
            const future = d > 2;
            return (
              <span
                key={d}
                className={`absolute flex flex-col justify-center rounded-lg px-1.5 transition-all duration-300 ${
                  forgot ? "border border-[#F2B8A4] bg-[#FDECE6]" : h ? (justFixed ? "border border-[#B9D9C5] bg-ok-soft ring-2 ring-accent/50" : "border border-[#CFE3D6] bg-[#EEF6F0]") : future ? "border border-dashed border-[#D6D2C7]" : ""
                }`}
                style={{ left: cellX(d), top: cellY(r) - 64, width: GRID.colW, height: GRID.rowH - 4 }}
              >
                {h ? (
                  <>
                    <b className="text-[12px] tabular-nums">{h}</b>
                    {forgot ? (
                      <span className="w-fit rounded bg-[#F8C9B8] px-1 text-[8.5px] font-semibold text-[#8A2A0A]">Sin salida</span>
                    ) : justFixed ? (
                      <span className="w-fit rounded bg-white/80 px-1 text-[8.5px] font-semibold text-accent">✓ Corregido</span>
                    ) : null}
                  </>
                ) : (
                  <span className="text-center text-[10px] text-[#B9B5AB]">{future ? "" : "—"}</span>
                )}
              </span>
            );
          })}
        </div>
      ))}
      <div className="absolute" style={{ left: GRID.left, top: cellY(5) - 64 + 6, right: 16 }}>
        {fixed ? <Banner tone="ok">Todo en orden · cada corrección queda con su motivo</Banner> : <Banner tone="bad">Jordi no fichó la salida el martes 13</Banner>}
      </div>

      {/* Editor del fichaje */}
      {editing && (
        <div className="absolute z-10 rounded-xl border border-line bg-surface p-3 shadow-xl" style={{ left: EDITOR.x, top: EDITOR.y - 64, width: 260, ...appear(t, 30_100, -6) }}>
          <div className="text-[12px] font-semibold">Jordi · martes 13</div>
          <div className="text-[10px] text-ink-muted">Previsto: Noche 17:00–01:00</div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Field label="Entrada" value="17:02" />
            <Field label="Salida" value={typed(t, 30_500, 31_100, "01:05") || "--:--"} active={t < 31_200} />
          </div>
          <div className="mt-2 text-[10px] font-semibold">Motivo</div>
          <div className="mt-1 flex flex-wrap gap-1">
            <span className={`rounded-full border px-2 py-0.5 text-[9.5px] ${t >= 31_400 ? "border-ink bg-ink text-white" : "border-line"}`}>Olvidó fichar la salida</span>
            <span className="rounded-full border border-line px-2 py-0.5 text-[9.5px]">Fichó en papel</span>
          </div>
          <div className="mt-2.5 flex justify-end">
            <span className={`rounded-lg bg-accent px-3 py-1.5 text-[11px] font-semibold text-white ${t >= 32_400 ? "scale-95" : ""}`}>Guardar</span>
          </div>
        </div>
      )}

      {/* Exportar */}
      {dialog && (
        <div className="absolute inset-0 z-10 bg-ink/20" style={{ opacity: appear(t, 35_900).opacity }}>
          <div className="absolute rounded-2xl bg-surface p-4 shadow-2xl" style={{ left: DIALOG.x, top: DIALOG.y - 64, width: 290, ...appear(t, 35_900, -6) }}>
            <div className="font-display text-[16px] font-bold">Exportar el registro</div>
            <div className="mt-2 text-[10px] font-semibold text-ink-muted">¿De qué mes?</div>
            <div className="mt-1 rounded-lg border border-line-strong px-2.5 py-1.5 text-[11px]">Octubre de 2026</div>
            <div className="mt-2 rounded-lg border-2 border-ink bg-ground px-2.5 py-1.5 text-[11px]">
              <b>Registro detallado</b>
              <span className="block text-[9.5px] text-ink-muted">Cada entrada y salida, con las correcciones</span>
            </div>
            <div className="mt-1.5 rounded-lg border border-line px-2.5 py-1.5 text-[11px] text-ink-soft">Resumen por persona</div>
            <div className="mt-3 flex justify-end">
              <span className={`rounded-lg bg-accent px-3 py-1.5 text-[11px] font-semibold text-white ${t >= 37_000 ? "scale-95" : ""}`}>Descargar Excel</span>
            </div>
          </div>
        </div>
      )}
      {downloaded && <Spreadsheet t={t} />}
    </div>
  );
}

function Spreadsheet({ t }: { t: number }) {
  const rows = [
    ["12/10", "Marta", "08:57", "17:02", "8,08", "Correcto", ""],
    ["12/10", "Jordi", "17:12", "01:05", "7,88", "Entró tarde", ""],
    ["13/10", "Jordi", "17:02", "01:05", "8,05", "Correcto", "Olvidó fichar la salida"],
    ["13/10", "Laura", "16:55", "01:03", "8,13", "Correcto", ""],
    ["14/10", "Laura", "16:58", "01:06", "8,13", "Correcto", ""],
  ];
  const shown = Math.round(prog(t, 37_600, 38_600) * rows.length);
  return (
    <div style={appear(t, 37_100, 24)} className="absolute bottom-3 left-4 right-4 z-10 overflow-hidden rounded-xl border border-[#B7D3C0] bg-surface shadow-2xl">
      <div className="flex items-center gap-2 bg-[#1D6F42] px-3 py-1.5 text-[11px] font-semibold text-white">
        <span className="rounded bg-white/20 px-1 text-[9px]">XLSX</span> registro-octubre-2026.xlsx
        <span className="ml-auto text-[10px] font-normal opacity-90">✓ Descargado</span>
      </div>
      <table className="w-full text-[9.5px] tabular-nums">
        <thead>
          <tr className="bg-[#EEF6F0] text-left">
            {["Fecha", "Persona", "Entrada", "Salida", "Horas", "Estado", "Motivo de la corrección"].map((h) => (
              <th key={h} className="border-b border-r border-[#D9E7DD] px-1.5 py-1 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, shown).map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className={`border-b border-r border-[#EDEBE5] px-1.5 py-[3px] ${j === 5 && c === "Entró tarde" ? "bg-[#FFF1DC]" : ""}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------- Aviso de la solicitud (encargado) ----------

function RequestNote({ t }: { t: number }) {
  if (t < 23_500 || t >= 27_600) return null;
  const accepted = t >= 24_800;
  return (
    <div className="absolute z-20 rounded-2xl border border-line bg-surface p-3.5 shadow-[0_20px_40px_-18px_rgba(27,27,26,0.55)]" style={{ left: NOTE.x, top: NOTE.y, width: 250, ...appear(t, 23_500, -10) }}>
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[#FFD9A8] text-[#7A3E00]">
          <Bell />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[9.5px] font-semibold uppercase tracking-[0.06em] text-ink-muted">Solicitud · ahora</div>
          <div className="text-[13px] font-semibold leading-snug">Laura pide librar el viernes 16</div>
          <div className="text-[11px] text-ink-muted">«Tengo médico»</div>
          {accepted ? (
            <span style={appear(t, 24_800, 4)} className="mt-2 inline-flex rounded-full bg-ok-soft px-2 py-0.5 text-[11px] font-semibold text-accent">✓ Aceptada</span>
          ) : (
            <div className="mt-2 flex gap-1.5">
              <span className={`rounded-md bg-accent px-2.5 py-1 text-[11px] font-semibold text-white transition ${t >= 24_700 ? "scale-95" : ""}`}>Aceptar</span>
              <span className="rounded-md border border-line-strong px-2.5 py-1 text-[11px] font-semibold">Rechazar</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Móvil de Laura ----------

function Phone({ t }: { t: number }) {
  const time = t < 13_000 ? "10:05" : t < 20_000 ? (t < 15_000 ? "16:58" : "16:59") : t < 28_000 ? "18:20" : "10:30";
  const view = t < 10_100 ? "lock" : t < 13_000 ? "week" : t < 28_000 ? "today" : "record";
  // Fundido entre pantallas: cada una se ve entre su inicio y el de la siguiente.
  const on = (a: number, b: number) => (a <= 0 ? 1 : ease(prog(t, a, a + 300))) * (1 - ease(prog(t, b, b + 300)));
  return (
    <div className="absolute z-10 rounded-[30px] border-[7px] border-ink bg-ink shadow-[0_30px_60px_-20px_rgba(27,27,26,0.6)]" style={{ left: PHONE.x, top: PHONE.y, width: PHONE.w, height: PHONE.h }}>
      <div className="relative h-full overflow-hidden rounded-[23px] bg-ground">
        {/* Barra de estado */}
        <div className={`relative z-20 flex h-6 items-center justify-between px-4 text-[10px] font-semibold ${view === "lock" ? "text-white" : "text-ink"}`}>
          <span className="tabular-nums">{time}</span>
          <span className="h-3.5 w-14 rounded-full bg-ink" />
          <span className="text-[8px]">●●● 4G</span>
        </div>

        <Fade o={on(0, 10_100)}>
          <div className="absolute inset-0 bg-[linear-gradient(160deg,#2C6E55,#123B2C)] px-3 pt-12 text-center text-white">
            <div className="text-[11px] opacity-80">lunes 12 de octubre</div>
            <div className="font-display text-[44px] font-semibold leading-none tracking-tight">10:05</div>
          </div>
        </Fade>
        <Fade o={on(10_100, 13_000)}>
          <WeekView t={t} />
        </Fade>
        <Fade o={on(13_000, 28_000)}>
          <TodayView t={t} />
        </Fade>
        <Fade o={on(28_000, Infinity)}>
          <RecordView />
        </Fade>

        {/* Notificaciones en el móvil */}
        <PhoneNotice t={t} from={8_800} to={10_100} top={106} title="Rotafy · Bar Central" text="Ya está tu horario del 12 al 18 de octubre" dark />
        <PhoneNotice t={t} from={25_900} to={27_900} title="Rotafy · ahora" text="Aceptado: librar el viernes 16" />
      </div>
    </div>
  );
}

function Fade({ o, children }: { o: number; children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 pt-6" style={{ opacity: o, visibility: o > 0 ? "visible" : "hidden" }}>
      {children}
    </div>
  );
}

function PhoneNotice({ t, from, to, title, text, dark = false, top = 30 }: { t: number; from: number; to: number; title: string; text: string; dark?: boolean; top?: number }) {
  // Baja desde arriba al llegar y vuelve a subir al irse.
  const p = ease(prog(t, from, from + 450)) * (1 - ease(prog(t, to, to + 400)));
  if (p <= 0) return null;
  return (
    <div
      className={`absolute left-2 right-2 z-30 rounded-2xl border border-line p-2.5 shadow-lg ${dark ? "bg-white/90" : "bg-surface"}`}
      style={{ top, opacity: p, transform: `translateY(${(p - 1) * 110}px)` }}
    >
      <div className="flex items-center gap-1.5 text-[9px] font-semibold text-ink-muted">
        <Mark size={13} /> {title}
      </div>
      <div className="mt-0.5 text-[11px] font-semibold leading-snug">{text}</div>
    </div>
  );
}

function WeekView({ t }: { t: number }) {
  const days: [string, string, string | null][] = [
    ["Lun", "12", null],
    ["Mar", "13", "17:00 – 01:00"],
    ["Mié", "14", "17:00 – 01:00"],
    ["Jue", "15", null],
    ["Vie", "16", "17:00 – 01:00"],
    ["Sáb", "17", "13:00 – 21:00"],
  ];
  return (
    <div className="px-3">
      <div className="font-display text-[17px] font-bold">Hola, Laura</div>
      <div className="text-[9.5px] text-ink-muted">Bar Central · Barra</div>
      <div className="mt-2 text-[11px] font-semibold">Esta semana · 32 h</div>
      <div className="mt-1 flex flex-col gap-1">
        {days.map(([d, n, s], i) => (
          <div
            key={d}
            className={`flex items-center gap-2 rounded-xl px-2 py-1.5 ${s ? "border border-line bg-surface" : "border border-dashed border-[#D6D2C7]"}`}
            style={appear(t, 10_200 + i * 90, 6)}
          >
            <span className="w-7 text-center leading-none">
              <span className="block text-[8px] text-ink-muted">{d}</span>
              <b className="text-[12px]">{n}</b>
            </span>
            <span className={`text-[10.5px] ${s ? "font-semibold" : "text-ink-muted"}`}>{s ?? "Libre"}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 rounded-lg bg-surface px-2 py-1.5 text-center text-[9.5px] font-semibold text-accent">📅 Añadido a tu calendario</div>
    </div>
  );
}

function TodayView({ t }: { t: number }) {
  const checking = t >= 14_600 && t < 15_700;
  const inside = t >= 15_700;
  const sheet = t >= 20_900 && t < 23_500;
  const sent = t >= 22_800;
  const friOff = t >= 26_000;
  return (
    <div className="relative h-full px-3">
      <div className="font-display text-[17px] font-bold">Hola, Laura</div>
      <div className="text-[9.5px] text-ink-muted">Bar Central · Barra</div>
      <div className="mt-2 rounded-2xl bg-accent p-3 text-white">
        <div className="text-[8.5px] font-semibold uppercase tracking-wide opacity-85">Hoy · miércoles 14</div>
        <div className="font-display text-[22px] font-bold leading-tight">17:00 – 01:00</div>
        <div className="text-[10px] opacity-90">Noche · con Jordi</div>
      </div>
      <div className="mt-2 rounded-2xl border border-line bg-surface p-2.5">
        <div className="text-[8.5px] font-semibold uppercase tracking-wide text-ink-muted">Fichaje</div>
        <div className="mt-0.5 text-[12px] font-bold">{inside ? "Trabajando desde 16:58" : "Aún no has fichado hoy"}</div>
        <div className={`mt-2 flex h-9 items-center justify-center rounded-xl text-[12px] font-semibold text-white transition ${inside ? "bg-ink" : "bg-accent"} ${t >= 14_500 && t < 14_800 ? "scale-95" : ""}`}>
          {checking ? "Comprobando…" : inside ? "Fichar salida" : "Fichar entrada"}
        </div>
        <div className={`mt-1.5 text-[9px] leading-snug ${inside ? "font-semibold text-accent" : "text-ink-muted"}`}>
          {checking ? "📍 Comprobando que estás en el local…" : inside ? "✓ Entrada a las 16:58 · en el local" : "📍 Tu ubicación no se guarda."}
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2 rounded-xl border border-dashed border-[#D6D2C7] px-2 py-1.5 text-[10px]">
        <b className="w-12">Vie 16</b>
        <span className={friOff ? "font-semibold text-accent" : ""}>{friOff ? "Libre ✓" : "17:00 – 01:00"}</span>
      </div>
      <div className={`mt-2 flex h-8 items-center justify-center rounded-xl border border-line-strong bg-surface text-[11px] font-semibold ${t >= 20_700 && t < 21_000 ? "scale-95" : ""}`}>Pedir un cambio</div>

      {/* Pedir librar */}
      {sheet && (
        <div className="absolute inset-x-0 bottom-0 z-10 rounded-t-2xl border-t border-line bg-surface p-3 shadow-[0_-10px_30px_-10px_rgba(0,0,0,0.25)]" style={{ top: 150, ...appear(t, 20_900, 40) }}>
          {sent ? (
            <div style={appear(t, 22_800, 6)} className="pt-10 text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-ok-soft text-lg text-accent">✓</div>
              <div className="mt-2 text-[12px] font-semibold">Solicitud enviada</div>
              <div className="text-[10px] text-ink-muted">Te avisamos cuando responda.</div>
            </div>
          ) : (
            <>
              <div className="text-[12px] font-bold">Pedir un cambio</div>
              <div className="mt-2 flex gap-1.5">
                <span className="rounded-full bg-ink px-2.5 py-1 text-[10px] font-semibold text-white">Librar</span>
                <span className="rounded-full border border-line px-2.5 py-1 text-[10px]">Cambiar con alguien</span>
              </div>
              <div className="mt-2 rounded-lg border border-line-strong px-2 py-1.5 text-[10.5px]">Viernes 16 · Noche</div>
              <div className="mt-1.5 min-h-[30px] rounded-lg border border-line-strong px-2 py-1.5 text-[10.5px]">
                {typed(t, 21_500, 22_400, "Tengo médico")}
                <span className="animate-pulse">|</span>
              </div>
              <div className={`mt-2 flex h-8 items-center justify-center rounded-xl bg-ink text-[11px] font-semibold text-white ${t >= 22_700 ? "scale-95" : ""}`}>Enviar</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function RecordView() {
  const rows: [string, string, string][] = [
    ["Mié 14", "16:58–01:06", "8:08"],
    ["Mar 13", "16:55–01:03", "8:08"],
    ["Sáb 10", "12:57–21:02", "8:05"],
    ["Vie 9", "16:59–01:01", "8:02"],
  ];
  return (
    <div className="px-3">
      <div className="font-display text-[15px] font-bold leading-tight">Mi registro de jornada</div>
      <div className="mt-2 flex items-center justify-between rounded-lg bg-surface px-2 py-1 text-[10px]">
        <span className="text-ink-muted">‹</span>
        <b>Octubre de 2026</b>
        <span className="text-ink-muted">›</span>
      </div>
      <div className="mt-2 font-display text-[26px] font-bold leading-none">64:23</div>
      <div className="text-[9.5px] text-ink-muted">8 días trabajados · hasta hoy</div>
      <div className="mt-2 divide-y divide-line rounded-xl border border-line bg-surface">
        {rows.map(([d, r, h]) => (
          <div key={d} className="flex items-center gap-1.5 px-2 py-1.5 text-[10px] tabular-nums">
            <span className="w-11 text-ink-muted">{d}</span>
            <span className="flex-1">{r}</span>
            <b>{h}</b>
          </div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <span className="rounded-lg border border-line-strong bg-surface py-1.5 text-center text-[10px] font-semibold">↓ Excel</span>
        <span className="rounded-lg border border-line-strong bg-surface py-1.5 text-center text-[10px] font-semibold">↓ CSV</span>
      </div>
    </div>
  );
}

// ---------- Piezas ----------

function Banner({ tone, children }: { tone: "ok" | "bad" | "muted"; children: React.ReactNode }) {
  const cls = tone === "ok" ? "bg-ok-soft text-accent" : tone === "bad" ? "bg-danger-soft text-danger-ink" : "bg-ground text-ink-muted";
  const dot = tone === "ok" ? "bg-accent" : tone === "bad" ? "bg-danger" : "bg-line-strong";
  return (
    <div className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[12px] font-medium ${cls}`}>
      <span className={`h-2 w-2 flex-none rounded-full ${dot}`} /> {children}
    </div>
  );
}

function Field({ label, value, active = false }: { label: string; value: string; active?: boolean }) {
  return (
    <span>
      <span className="block text-[9.5px] text-ink-muted">{label}</span>
      <span className={`mt-0.5 block rounded-lg border px-2 py-1 text-[12px] tabular-nums ${active ? "border-ink ring-2 ring-accent/20" : "border-line-strong"}`}>{value}</span>
    </span>
  );
}

export function Mark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="9" fill="#1F5C46" />
      <path d="M10 13.5a6.5 6.5 0 0 1 11.3-3.9" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M22 18.5a6.5 6.5 0 0 1-11.3 3.9" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M21.9 6.2v4h-4" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10.1 25.8v-4h4" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Bell() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 9.5a6 6 0 0112 0c0 4.5 1.8 6.2 2.5 6.8H3.5c.7-.6 2.5-2.3 2.5-6.8z" />
      <path d="M10 19.5a2.2 2.2 0 004 0" />
    </svg>
  );
}
