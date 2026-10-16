"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { CHAPTERS, clamp, Content, ease, H, Mark, Overlay, paintOverlay, prog, TOTAL, W } from "../_landing/HeroDemo";

/*
 * Vídeo promocional (1920×1080, 60 s). Igual que la animación de la portada,
 * todo sale del tiempo `t` (ms), así cada fotograma se puede pintar exacto:
 * /promo?render=1 expone window.__seek(ms) y un script captura fotograma a
 * fotograma. Sin ?render se reproduce en bucle para verlo en el navegador.
 */

export const FILM = 60_000;
const FW = 1920;
const FH = 1080;

// La parte de la app: la animación de la portada, un poco más rápida.
const DEMO_IN = 9_400;
const SPEED = 1.15;
const DEMO_FROM = 300;
const DEMO_TO = 40_400;
const demoT = (ft: number) => clamp(DEMO_FROM + (ft - DEMO_IN) * SPEED, DEMO_FROM, DEMO_TO);
/** Momento del vídeo en el que pasa algo de la animación (para cuadrar textos y sonido). */
export const filmAt = (dt: number) => DEMO_IN + (dt - DEMO_FROM) / SPEED;
const DEMO_OUT = filmAt(DEMO_TO); // ≈ 44,3 s
const FEAT_IN = 44_200;
const END_IN = 51_800;

const C = { ground: "#F4F3EE", ink: "#1B1B1A", accent: "#1F5C46", mint: "#8FD3B0", night: "#121211" };

const out3 = (p: number) => 1 - (1 - p) ** 3;
const back = (p: number) => {
  const c1 = 1.5;
  return 1 + (c1 + 1) * (p - 1) ** 3 + c1 * (p - 1) ** 2;
};
/** Entra en `a` (dura `d`) y sale en `b`: 0 → 1 → 0. */
const life = (t: number, a: number, b = Infinity, d = 500) => out3(prog(t, a, a + d)) * (1 - ease(prog(t, b, b + 400)));

// ---------- Guion ----------

const BUBBLES = [
  { at: 700, x: 210, y: 150, r: -3, who: "Jordi", text: "¿Alguien me cubre el sábado?" },
  { at: 980, x: 1190, y: 110, r: 2, who: "Laura", text: "¿Me pasas el horario? No lo encuentro" },
  { at: 1240, x: 1390, y: 470, r: 3, who: "Tú", text: "cuadrante_FINAL_v3.jpg", photo: true },
  { at: 1480, x: 150, y: 560, r: -2, who: "Pol", text: "Mañana no puedo, lo siento" },
  { at: 1700, x: 690, y: 850, r: 1.5, who: "Marta", text: "¿Quién cierra el viernes?" },
  { at: 1900, x: 1250, y: 880, r: -2.5, who: "Aleix", text: "Me has puesto 3 cierres seguidos…" },
  { at: 2100, x: 430, y: 360, r: 2, who: "Gestoría", text: "¿Me mandas las horas de octubre?" },
  { at: 2280, x: 1500, y: 300, r: -1.5, who: "Jordi", text: "¿Hola?" },
  { at: 2440, x: 820, y: 140, r: 2.5, who: "Laura", text: "¿Al final quién libra el domingo?" },
] as const;

const CAPTIONS = [
  { title: "Genera la semana", text: "Un clic y Rotafy reparte los turnos respetando descansos, contratos y vacaciones." },
  { title: "Publica y avisa", text: "Cada persona recibe su horario en el móvil. Sin fotos en el grupo." },
  { title: "Fichan desde el móvil", text: "Solo desde el local, y la hora la pone el servidor. Tú lo ves al momento." },
  { title: "Cambios sin mensajes", text: "Laura pide librar. Aceptas con un toque y Pol cubre su turno." },
  { title: "Olvidos resueltos", text: "Corriges un fichaje y queda guardado el motivo." },
  { title: "El registro, en Excel", text: "A fin de mes, un clic y se lo mandas a la gestoría." },
];
const CAP_START = CHAPTERS.map((c, i) => (i === 0 ? DEMO_IN + 200 : filmAt(c.start)));

/** Cámara sobre la animación: [ms de la animación, zoom, punto que se mira (x, y)]. */
const CAMERA: [number, number, number, number][] = [
  [0, 1, 395, 285],
  [900, 1, 395, 285],
  [2_000, 1.32, 300, 268],
  [6_600, 1.32, 300, 268],
  [7_700, 1, 395, 285],
  [8_500, 1, 395, 285],
  [9_400, 1.55, 678, 318],
  [12_600, 1.55, 678, 318],
  [13_300, 1.55, 678, 318],
  [15_600, 1.55, 678, 318],
  [16_300, 1.08, 420, 285],
  [19_300, 1.08, 420, 285],
  [20_200, 1.55, 678, 318],
  [23_000, 1.55, 678, 318],
  [23_700, 1.05, 410, 280],
  [27_800, 1.05, 410, 280],
  [28_700, 1.32, 300, 262],
  [33_400, 1.32, 300, 262],
  [34_600, 1.06, 330, 280],
  [36_700, 1.06, 330, 280],
  [37_600, 1.3, 300, 352],
  [TOTAL, 1.36, 300, 352],
];

function cameraAt(dt: number) {
  let i = CAMERA.findIndex(([ms]) => ms > dt);
  if (i <= 0) i = i === 0 ? 1 : CAMERA.length - 1;
  const [t0, z0, x0, y0] = CAMERA[i - 1];
  const [t1, z1, x1, y1] = CAMERA[i];
  const p = ease(prog(dt, t0, t1));
  return { z: z0 + (z1 - z0) * p, x: x0 + (x1 - x0) * p, y: y0 + (y1 - y0) * p };
}

const FEATURES = [
  { icon: "clock", title: "Turnos partidos", text: "Franjas con el nombre y el horario que uséis." },
  { icon: "pin", title: "Fichar desde el local", text: "Por GPS o wifi, sin guardar dónde está nadie." },
  { icon: "home", title: "Teletrabajo", text: "Días en casa en los que puede fichar desde fuera." },
  { icon: "bell", title: "Avisos en el móvil", text: "Notificación al momento, para ti y tu equipo." },
  { icon: "team", title: "Varios encargados", text: "Invita a quien te ayuda, cada uno con su cuenta." },
  { icon: "plane", title: "Vacaciones y bajas", text: "El generador no pone turnos esos días." },
  { icon: "send", title: "WhatsApp o Telegram", text: "Su horario con un toque. Si cambia, solo a quien afecta." },
  { icon: "grid", title: "16 sectores", text: "Bares, tiendas, clínicas, limpieza… y lo cambias todo." },
] as const;

// ---------- Componente ----------

declare global {
  interface Window {
    __seek?: (ms: number) => void;
    __filmReady?: boolean;
  }
}

export function PromoFilm({ render = false }: { render?: boolean }) {
  const [t, setT] = useState(0);
  const [scale, setScale] = useState(1);
  const overlayRef = useRef<HTMLDivElement>(null);
  const dt = demoT(t);

  useLayoutEffect(() => {
    paintOverlay(overlayRef.current, dt);
    // El fundido del bucle de la portada no hace falta aquí.
    const fade = overlayRef.current?.querySelector<HTMLElement>('[data-k="fade"]');
    if (fade) fade.style.opacity = "0";
  });

  useEffect(() => {
    if (render) {
      window.__seek = (ms: number) => flushSync(() => setT(ms));
      window.__filmReady = true;
      return;
    }
    const fit = () => setScale(Math.min(window.innerWidth / FW, window.innerHeight / FH));
    fit();
    window.addEventListener("resize", fit);
    let raf = 0;
    const t0 = performance.now();
    const loop = (now: number) => {
      setT((now - t0) % FILM);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", fit);
    };
  }, [render]);

  return (
    <div className={`film fixed inset-0 overflow-hidden ${render ? "" : "flex items-center justify-center"}`} style={{ background: "#000" }}>
      <style>{`.film *, .film *::before, .film *::after { transition: none !important; animation: none !important; }`}</style>
      <div className="relative flex-none overflow-hidden font-sans" style={{ width: FW, height: FH, transform: render ? undefined : `scale(${scale})`, background: C.ground }}>
        {t < 5_300 && <Hook t={t} />}
        {t >= 5_250 && t < DEMO_IN && <LogoScene t={t} />}
        {t >= DEMO_IN && t < END_IN + 400 && <DemoScene t={t} dt={dt} overlayRef={overlayRef} />}
        {t >= FEAT_IN && t < END_IN + 1_000 && <Features t={t} />}
        {t >= END_IN - 800 && <EndCard t={t} />}
        {/* Fundido desde y hacia negro */}
        <div className="pointer-events-none absolute inset-0 bg-black" style={{ opacity: 1 - prog(t, 0, 500) + prog(t, FILM - 900, FILM) }} />
      </div>
    </div>
  );
}

// ---------- 1. El problema ----------

function Hook({ t }: { t: number }) {
  const dim = ease(prog(t, 2_700, 3_200));
  const unread = Math.round(3 + 44 * prog(t, 700, 2_600));
  const wipe = ease(prog(t, 4_300, 5_300));
  return (
    <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 50% 40%, #232321, ${C.night} 70%)` }}>
      {/* Hora y mensajes sin leer */}
      <div className="absolute left-1/2 top-[52px] flex -translate-x-1/2 items-center gap-4 text-[26px] font-semibold text-white/70" style={{ opacity: life(t, 150, 2_700) }}>
        <span className="tabular-nums">Domingo, 23:47</span>
        <span className="rounded-full bg-[#E5484D] px-3.5 py-0.5 text-[22px] font-bold tabular-nums text-white">{unread} sin leer</span>
      </div>

      {/* Los mensajes de siempre */}
      <div className="absolute inset-0" style={{ opacity: 1 - dim * 0.78, filter: dim ? `blur(${dim * 7}px)` : undefined }}>
        {BUBBLES.map((b, i) => {
          const p = prog(t, b.at, b.at + 420);
          if (p <= 0) return null;
          const drift = Math.sin((t / 900) + i) * 6;
          return (
            <div
              key={i}
              className="absolute rounded-[26px] rounded-tl-[8px] bg-white px-7 py-5 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.7)]"
              style={{
                left: b.x,
                top: b.y + drift,
                maxWidth: 560,
                opacity: Math.min(1, p * 2.5),
                transform: `rotate(${b.r}deg) scale(${0.55 + 0.45 * back(p)})`,
                transformOrigin: "top left",
              }}
            >
              <div className="text-[20px] font-bold" style={{ color: ["#1F8A5B", "#B4561F", "#2563A8", "#8A3FA0"][i % 4] }}>
                {b.who}
              </div>
              {"photo" in b && b.photo ? (
                <div className="mt-2">
                  <div className="h-[150px] w-[300px] rotate-[-1deg] overflow-hidden rounded-xl bg-[#d9d6cc] p-3 [filter:blur(0.6px)_contrast(0.9)]">
                    <div className="grid h-full grid-cols-6 gap-1 opacity-70">
                      {Array.from({ length: 30 }).map((_, k) => (
                        <span key={k} className={`rounded-sm ${k % 7 === 2 ? "bg-[#c6a983]" : k % 5 === 1 ? "bg-[#9fb8a5]" : "bg-[#ece9e1]"}`} />
                      ))}
                    </div>
                  </div>
                  <div className="mt-2 text-[22px] text-[#555]">{b.text}</div>
                </div>
              ) : (
                <div className="mt-0.5 text-[30px] leading-snug text-[#1B1B1A]">{b.text}</div>
              )}
            </div>
          );
        })}
      </div>

      {/* La pregunta */}
      <div className="absolute inset-x-0 top-[390px] text-center font-display font-bold tracking-[-0.03em] text-white">
        <div className="text-[84px] leading-tight" style={{ opacity: life(t, 2_800, 9_999, 600), transform: `translateY(${(1 - out3(prog(t, 2_800, 3_400))) * 30}px)` }}>
          Cada semana, lo mismo.
        </div>
        <div className="text-[84px] leading-tight" style={{ color: C.mint, opacity: life(t, 3_350, 9_999, 600), transform: `translateY(${(1 - out3(prog(t, 3_350, 3_950))) * 30}px)` }}>
          ¿Y si se hiciera solo?
        </div>
      </div>

      {/* Círculo verde que lo barre todo */}
      {wipe > 0 && <div className="absolute rounded-full" style={{ left: FW / 2, top: FH / 2, width: 4_400, height: 4_400, marginLeft: -2_200, marginTop: -2_200, background: C.accent, transform: `scale(${wipe})` }} />}
    </div>
  );
}

// ---------- 2. El logo ----------

function LogoScene({ t }: { t: number }) {
  const markP = prog(t, 5_250, 6_150);
  const leave = ease(prog(t, 8_500, 9_400));
  const word = "rotafy";
  return (
    <div className="absolute inset-0" style={{ background: C.accent }}>
      {/* El brillo entra poco a poco para que el paso desde el círculo no dé un salto */}
      <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 50% 45%, #2A7458, ${C.accent} 65%)`, opacity: ease(prog(t, 5_250, 6_400)) }} />
      <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ transform: `translateY(${-leave * 160}px)`, opacity: 1 - leave }}>
        <div className="flex items-center gap-10">
          <div style={{ transform: `scale(${markP > 0 ? back(markP) : 0})`, opacity: Math.min(1, markP * 3) }}>
            <svg width={190} height={190} viewBox="0 0 32 32" aria-hidden>
              <rect width="32" height="32" rx="9" fill="#fff" />
              <g style={{ transform: `rotate(${(1 - out3(prog(t, 5_300, 6_500))) * -180}deg)`, transformOrigin: "16px 16px" }}>
                <path d="M10 13.5a6.5 6.5 0 0 1 11.3-3.9" fill="none" stroke={C.accent} strokeWidth="2.6" strokeLinecap="round" />
                <path d="M22 18.5a6.5 6.5 0 0 1-11.3 3.9" fill="none" stroke={C.accent} strokeWidth="2.6" strokeLinecap="round" />
                <path d="M21.9 6.2v4h-4" fill="none" stroke={C.accent} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M10.1 25.8v-4h4" fill="none" stroke={C.accent} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
              </g>
            </svg>
          </div>
          <div className="flex overflow-hidden pb-4 font-display text-[200px] font-bold leading-none tracking-[-0.04em] text-white">
            {word.split("").map((ch, i) => {
              const p = out3(prog(t, 5_600 + i * 55, 5_600 + i * 55 + 600));
              return (
                <span key={i} style={{ transform: `translateY(${(1 - p) * 110}%)`, opacity: p }}>
                  {ch}
                </span>
              );
            })}
          </div>
        </div>
        <div className="mt-10 font-display text-[50px] font-semibold tracking-[-0.02em] text-white/90" style={{ opacity: life(t, 6_450, 99_999, 700), transform: `translateY(${(1 - out3(prog(t, 6_450, 7_150))) * 24}px)` }}>
          El cuadrante de la semana en <span style={{ color: C.mint }}>1 minuto</span>.
        </div>
      </div>
      {/* Telón claro que sube y deja ver la app */}
      <div className="absolute inset-x-0 bottom-0" style={{ height: FH, background: C.ground, transform: `translateY(${(1 - ease(prog(t, 8_500, 9_400))) * 100}%)`, borderRadius: `${(1 - prog(t, 8_900, 9_400)) * 80}px ${(1 - prog(t, 8_900, 9_400)) * 80}px 0 0` }} />
    </div>
  );
}

// ---------- 3. La app en acción ----------

function DemoScene({ t, dt, overlayRef }: { t: number; dt: number; overlayRef: React.RefObject<HTMLDivElement | null> }) {
  const cam = cameraAt(dt);
  const s0 = 1.47;
  const s = s0 * cam.z;
  // Viewport de la animación: la parte derecha del vídeo.
  const VX = 640;
  const cx = 660;
  const cy = 548;
  const enter = out3(prog(t, DEMO_IN, DEMO_IN + 900));
  const exit = ease(prog(t, DEMO_OUT - 300, DEMO_OUT + 450));
  const chapter = CAP_START.reduce((acc, c, i) => (t >= c ? i : acc), 0);
  return (
    <div className="absolute inset-0" style={{ background: C.ground }}>
      <Backdrop t={t} />

      {/* Marca */}
      <div className="absolute left-[110px] top-[72px] flex items-center gap-3 font-display text-[34px] font-bold tracking-tight text-ink" style={{ opacity: enter * (1 - exit) }}>
        <Mark size={40} /> rotafy
      </div>

      {/* Textos de cada parte */}
      <div className="absolute left-[110px] top-0 flex h-full w-[520px] flex-col justify-center" style={{ opacity: 1 - exit }}>
        {CAPTIONS.map((c, i) => {
          const a = CAP_START[i];
          const b = (CAP_START[i + 1] ?? DEMO_OUT + 600) - 380;
          const pin = out3(prog(t, a + 120, a + 720));
          const pout = ease(prog(t, b, b + 360));
          if (pin <= 0 || pout >= 1) return null;
          return (
            <div key={c.title} className="absolute left-0 right-0" style={{ opacity: pin * (1 - pout), transform: `translateY(${(1 - pin) * 40 - pout * 30}px)` }}>
              <div className="flex items-center gap-4 text-[22px] font-bold tabular-nums" style={{ color: C.accent }}>
                {String(i + 1).padStart(2, "0")}
                <span className="h-[2px] rounded-full" style={{ width: 70 * pin, background: C.accent }} />
              </div>
              <h2 className="mt-5 font-display text-[68px] font-bold leading-[1.02] tracking-[-0.035em] text-ink">{c.title}</h2>
              <p className="mt-6 text-[29px] leading-[1.45] text-ink-soft">{c.text}</p>
            </div>
          );
        })}
        {/* Progreso por partes */}
        <div className="absolute bottom-[110px] left-0 flex w-[300px] gap-2" style={{ opacity: enter }}>
          {CAPTIONS.map((_, i) => {
            const a = CAP_START[i];
            const b = CAP_START[i + 1] ?? DEMO_OUT;
            const fill = i < chapter ? 1 : i > chapter ? 0 : prog(t, a, b);
            return (
              <span key={i} className="h-[5px] flex-1 overflow-hidden rounded-full bg-[#DCD8CD]">
                <span className="block h-full rounded-full" style={{ width: `${fill * 100}%`, background: C.accent }} />
              </span>
            );
          })}
        </div>
      </div>

      {/* La animación, con cámara */}
      <div
        className="absolute top-0 overflow-hidden"
        style={{
          left: VX,
          width: FW - VX,
          height: FH,
          maskImage: "linear-gradient(to right, transparent 0, #000 110px)",
          WebkitMaskImage: "linear-gradient(to right, transparent 0, #000 110px)",
          opacity: enter * (1 - exit),
          transform: `translateY(${(1 - enter) * 80 - exit * 60}px) scale(${1 - exit * 0.06})`,
        }}
      >
        <div
          className="absolute left-0 top-0 origin-top-left select-none"
          style={{ width: W, height: H, transform: `translate(${cx - cam.x * s}px, ${cy - cam.y * s}px) scale(${s})` }}
        >
          <Content t={dt} />
          <Overlay overlayRef={overlayRef} />
        </div>
      </div>
    </div>
  );
}

function Backdrop({ t }: { t: number }) {
  const drift = t / 1000;
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute rounded-full" style={{ left: 1050 + Math.sin(drift * 0.3) * 60, top: -260 + Math.cos(drift * 0.25) * 40, width: 1200, height: 900, background: "radial-gradient(closest-side, rgba(31,92,70,0.17), transparent)" }} />
      <div className="absolute rounded-full" style={{ left: -300 + Math.cos(drift * 0.2) * 50, top: 560, width: 1000, height: 800, background: "radial-gradient(closest-side, rgba(31,92,70,0.08), transparent)" }} />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "linear-gradient(to right, rgba(27,27,26,0.045) 1px, transparent 1px), linear-gradient(to bottom, rgba(27,27,26,0.045) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(ellipse at 70% 40%, #000 20%, transparent 70%)",
          WebkitMaskImage: "radial-gradient(ellipse at 70% 40%, #000 20%, transparent 70%)",
        }}
      />
    </div>
  );
}

// ---------- 4. Y además ----------

function Features({ t }: { t: number }) {
  const a = FEAT_IN + 500;
  const leave = ease(prog(t, END_IN - 900, END_IN));
  return (
    <div className="absolute inset-0" style={{ opacity: 1 - leave * 0.4, transform: `scale(${1 + leave * 0.04})` }}>
      <div className="absolute inset-x-0 top-[150px] text-center">
        <div className="text-[24px] font-bold uppercase tracking-[0.16em]" style={{ color: C.accent, opacity: life(t, a, 99_999, 600) }}>
          Y además
        </div>
        <h2 className="mt-4 font-display text-[78px] font-bold leading-none tracking-[-0.035em] text-ink" style={{ opacity: life(t, a + 120, 99_999, 700), transform: `translateY(${(1 - out3(prog(t, a + 120, a + 820))) * 30}px)` }}>
          Todo lo que pide tu día a día.
        </h2>
      </div>
      <div className="absolute left-1/2 top-[410px] grid -translate-x-1/2 grid-cols-4 gap-7" style={{ width: 1640 }}>
        {FEATURES.map((f, i) => {
          const at = a + 700 + i * 140;
          const p = out3(prog(t, at, at + 650));
          const hi = Math.max(0, 1 - Math.abs(t - (a + 3_400 + i * 260)) / 420);
          return (
            <div
              key={f.title}
              className="rounded-[28px] border bg-surface p-8"
              style={{
                opacity: p,
                transform: `translateY(${(1 - p) * 50}px) scale(${0.96 + 0.04 * p})`,
                borderColor: hi > 0 ? `rgba(31,92,70,${0.15 + hi * 0.5})` : "#E6E3DA",
                boxShadow: `0 30px 60px -36px rgba(27,27,26,${0.35 + hi * 0.25})`,
              }}
            >
              <span className="flex h-[64px] w-[64px] items-center justify-center rounded-2xl" style={{ background: hi > 0.2 ? C.accent : "#E3EFE8", color: hi > 0.2 ? "#fff" : C.accent }}>
                <Icon name={f.icon} />
              </span>
              <div className="mt-6 text-[30px] font-bold leading-tight tracking-[-0.01em] text-ink">{f.title}</div>
              <div className="mt-2 text-[22px] leading-snug text-ink-soft">{f.text}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- 5. Cierre ----------

function EndCard({ t }: { t: number }) {
  const wipe = ease(prog(t, END_IN - 700, END_IN + 100));
  const a = END_IN + 100;
  const logo = prog(t, a, a + 900);
  return (
    <div className="absolute inset-0">
      <div className="absolute overflow-hidden rounded-full" style={{ left: FW / 2, top: FH / 2, width: 4_400, height: 4_400, marginLeft: -2_200, marginTop: -2_200, background: C.night, transform: `scale(${wipe})` }} />
      {wipe >= 1 && (
        <div className="absolute inset-0" style={{ background: C.night }}>
          <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 50% 42%, #1E3B30 0%, ${C.night} 62%)`, opacity: ease(prog(t, END_IN + 100, END_IN + 1_300)) }} />
          <div className="absolute rounded-full" style={{ left: FW / 2 - 700, top: 120, width: 1400, height: 700, background: "radial-gradient(closest-side, rgba(143,211,176,0.16), transparent)", opacity: prog(t, a, a + 2_000) }} />
          <div className="absolute inset-x-0 top-[270px] flex flex-col items-center text-center">
            <div className="flex items-center gap-7" style={{ opacity: Math.min(1, logo * 2.5), transform: `scale(${0.8 + 0.2 * back(logo)})` }}>
              <Mark size={128} />
              <span className="font-display text-[150px] font-bold leading-none tracking-[-0.04em] text-white">rotafy</span>
            </div>
            <div className="mt-12 font-display text-[60px] font-semibold leading-tight tracking-[-0.025em] text-white" style={{ opacity: life(t, a + 900, 99_999, 700), transform: `translateY(${(1 - out3(prog(t, a + 900, a + 1_600))) * 26}px)` }}>
              Menos tiempo con el Excel. <span style={{ color: C.mint }}>Más con tu equipo.</span>
            </div>
            <div
              className="mt-14 rounded-full px-14 py-7 font-display text-[46px] font-bold tracking-[-0.02em] text-white"
              style={{
                background: C.accent,
                boxShadow: `0 0 0 ${2 + Math.sin(t / 260) * 0.5}px rgba(143,211,176,0.35), 0 30px 80px -10px rgba(31,92,70,0.9)`,
                opacity: life(t, a + 1_900, 99_999, 600),
                transform: `scale(${0.9 + 0.1 * back(prog(t, a + 1_900, a + 2_600))})`,
              }}
            >
              Empieza gratis en rotafy.es
            </div>
            <div className="mt-10 flex gap-10 text-[26px] text-white/60" style={{ opacity: life(t, a + 2_800, 99_999, 700) }}>
              <span>Sin tarjeta</span>
              <span>·</span>
              <span>Tu equipo no instala nada</span>
              <span>·</span>
              <span>Datos en Europa</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Iconos ----------

function Icon({ name }: { name: (typeof FEATURES)[number]["icon"] }) {
  const paths: Record<typeof name, React.ReactNode> = {
    clock: (
      <>
        <circle cx="11" cy="11" r="8" />
        <path d="M11 6.5V11l3 2" />
      </>
    ),
    pin: (
      <>
        <path d="M11 19.5s6-5.4 6-10a6 6 0 00-12 0c0 4.6 6 10 6 10z" />
        <circle cx="11" cy="9.5" r="2.2" />
      </>
    ),
    home: <path d="M3.5 10L11 3.5l7.5 6.5V18a1 1 0 01-1 1h-4v-5h-5v5h-4a1 1 0 01-1-1z" />,
    bell: (
      <>
        <path d="M5.5 9a5.5 5.5 0 0111 0c0 4 1.6 5.6 2.3 6.2H3.2C3.9 14.6 5.5 13 5.5 9z" />
        <path d="M9 18.5a2 2 0 004 0" />
      </>
    ),
    team: (
      <>
        <circle cx="8" cy="8" r="3" />
        <path d="M2.5 18a5.5 5.5 0 0111 0" />
        <circle cx="15.5" cy="7" r="2.5" />
        <path d="M15 12.5a4.5 4.5 0 014.5 4.5" />
      </>
    ),
    plane: <path d="M2.5 13.5l17-7-4 14-4.5-5.5-5.5-.5zM11 15l8.5-8.5" />,
    send: <path d="M3 10.5l16-7-6 16-2.5-6.5L3 10.5zM10.5 13l8.5-9.5" />,
    grid: (
      <>
        <rect x="3.5" y="3.5" width="6" height="6" rx="1.5" />
        <rect x="12.5" y="3.5" width="6" height="6" rx="1.5" />
        <rect x="3.5" y="12.5" width="6" height="6" rx="1.5" />
        <rect x="12.5" y="12.5" width="6" height="6" rx="1.5" />
      </>
    ),
  };
  return (
    <svg aria-hidden viewBox="0 0 22 22" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}
