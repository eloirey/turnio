"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { CUADRANTE_EVENT, GuidePanel, GuideWaiting, guideBtn, highlightTour, type CuadranteEvent } from "./GuidePanel";

/**
 * Guía paso a paso dentro de la app de verdad. Se abre sola al crear el
 * negocio y luego siempre con el botón «Guía» de la cabecera. El paso en el
 * que vas se recuerda en este navegador (si no se puede, solo en memoria).
 */

interface Step {
  href: string;
  title: string;
  body: string;
  cta?: string;
  highlight?: string;
  final?: boolean;
}

const STEPS: Step[] = [
  {
    href: "/app/empleados",
    title: "Añade a tu equipo",
    body: "Pulsa «+ Añadir persona»: nombre, puesto, horas de contrato y qué franjas puede trabajar cada día. En «Preferencias y reglas propias» le das días libres preferidos o reglas solo para esa persona.",
    cta: "Siguiente: necesidades",
  },
  {
    href: "/app/necesidades",
    title: "Cuánta gente necesitas",
    body: "Para cada franja y día, cuántas personas de cada puesto. Abajo puedes renombrar las franjas (por ejemplo, «Línea 12»), cambiar horarios o añadir otra. Pulsa «Guardar» al acabar.",
    cta: "Siguiente: el cuadrante",
  },
  {
    href: "/app/cuadrante",
    title: "Genera el cuadrante",
    body: "Pulsa «Generar automáticamente». Rotafy reparte los turnos respetando disponibilidad, contratos, ausencias, descansos y las reglas de cada persona.",
    highlight: "generar",
  },
  {
    href: "/app/cuadrante",
    title: "Retoca y publica",
    body: "Toca cualquier casilla para cambiarla: si rompes una regla la verás en rojo y en el panel lateral. Cuando te guste, pulsa «Publicar y avisar» y manda a cada uno su horario por WhatsApp.",
    highlight: "publicar",
  },
  {
    href: "/app/empleados",
    title: "Su enlace personal",
    body: "Toca a una persona y abajo verás su enlace único: ahí ve su horario, ficha y lo añade a su calendario, sin registrarse. Es solo suyo (con él se ficha a su nombre), así que no debe compartirlo. Si lo pierde o lo comparte, toca «cambia el enlace» y el anterior deja de funcionar.",
    highlight: "enlace",
    cta: "Siguiente: fichajes",
  },
  {
    href: "/app/fichajes",
    title: "El registro de jornada",
    body: "Actívalo y tu equipo fichará desde su enlace. Aquí ves las horas de cada uno y corriges olvidos (queda el motivo, como pide la ley). En el cuadrante, debajo de cada turno, verás a qué hora fichó. Descarga el Excel cada mes y guárdalo: hay que conservarlo 4 años.",
    cta: "Siguiente: ajustes",
  },
  {
    href: "/app/ajustes",
    title: "Tus reglas",
    body: "Descanso entre jornadas, días libres, cierres seguidos, horas extra y margen de retraso: escribe los valores de tu convenio. Rotafy los aplica al generar y te avisa si algo se sale de lo normal.",
    cta: "Terminar",
  },
  {
    href: "/app/cuadrante",
    title: "¡Todo listo!",
    body: "Si te surge una duda en cualquier pantalla, pulsa «Ayuda» arriba. Desde ahí también puedes repetir esta guía.",
    final: true,
  },
];

// ---------- Estado compartido entre el botón y el panel ----------

const KEY = "rotafy:guia";
interface Saved {
  open: boolean;
  step: number;
}
const CLOSED = JSON.stringify({ open: false, step: 0 } satisfies Saved);
const NEW_ACCOUNT = JSON.stringify({ open: true, step: 0 } satisfies Saved);

let memory: string | null = null;
const listeners = new Set<() => void>();

function readStored(): string | null {
  try {
    return window.localStorage.getItem(KEY) ?? memory;
  } catch {
    return memory;
  }
}

function snapshot(): string {
  const stored = readStored();
  if (stored) return stored;
  // Recién creado el negocio: la guía se abre sola.
  const fresh = window.location.pathname.startsWith("/app/empleados") && new URLSearchParams(window.location.search).get("nuevo") === "1";
  return fresh ? NEW_ACCOUNT : CLOSED;
}

function parse(raw: string): Saved {
  try {
    const v = JSON.parse(raw) as Partial<Saved>;
    const step = Number.isInteger(v.step) ? Math.min(Math.max(0, v.step as number), STEPS.length - 1) : 0;
    return { open: v.open === true, step };
  } catch {
    return { open: false, step: 0 };
  }
}

function save(next: Saved) {
  const raw = JSON.stringify(next);
  memory = raw;
  try {
    window.localStorage.setItem(KEY, raw);
  } catch {
    // Navegación privada o almacenamiento bloqueado: vale con la memoria.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function useGuideState(): Saved {
  const raw = useSyncExternalStore(subscribe, snapshot, () => CLOSED);
  return parse(raw);
}

/** Empieza la guía paso a paso desde el principio (la abre la Ayuda). */
export function startGuide(navigate: (href: string) => void, pathname: string) {
  save({ open: true, step: 0 });
  if (!pathname.startsWith(STEPS[0].href)) navigate(STEPS[0].href);
}

// ---------- Panel ----------

export function AppGuide() {
  const state = useGuideState();
  const { open, step } = state;
  const pathname = usePathname();
  const router = useRouter();
  const current = STEPS[state.step];
  const onPage = pathname.startsWith(current.href);

  function goTo(n: number) {
    save({ open: true, step: n });
    if (!pathname.startsWith(STEPS[n].href)) router.push(STEPS[n].href);
  }

  // Si se abrió sola (cuenta nueva), se guarda para que siga abierta al navegar.
  useEffect(() => {
    if (open && readStored() === null) save({ open, step });
  }, [open, step]);

  // Generar y publicar hacen avanzar la guía solos.
  useEffect(() => {
    if (!open) return;
    const onEvent = (e: Event) => {
      const kind = (e as CustomEvent<CuadranteEvent>).detail;
      if (kind === "generated" && step === 2) save({ open: true, step: 3 });
      if (kind === "published" && (step === 2 || step === 3)) save({ open: true, step: 4 });
    };
    window.addEventListener(CUADRANTE_EVENT, onEvent);
    return () => window.removeEventListener(CUADRANTE_EVENT, onEvent);
  }, [open, step]);

  const highlight = current.highlight;
  useEffect(() => {
    if (!open || !onPage || !highlight) return;
    return highlightTour(highlight);
  }, [open, onPage, highlight, pathname]);

  if (!state.open) return null;

  return (
    <GuidePanel
      index={state.step}
      total={STEPS.length}
      title={current.title}
      body={current.body}
      onHide={() => save({ open: false, step: state.step })}
      onBack={() => goTo(state.step - 1)}
      onSkip={!current.final && !current.cta ? () => goTo(state.step + 1) : undefined}
      action={
        current.final ? (
          <button onClick={() => save({ open: false, step: 0 })} className={guideBtn}>
            Cerrar la guía
          </button>
        ) : !onPage ? (
          <button onClick={() => router.push(current.href)} className={guideBtn}>
            Ir a {LABEL[current.href]}
          </button>
        ) : current.cta ? (
          <button onClick={() => goTo(state.step + 1)} className={guideBtn}>
            {current.cta} →
          </button>
        ) : (
          <GuideWaiting />
        )
      }
    />
  );
}

const LABEL: Record<string, string> = {
  "/app/cuadrante": "Cuadrante",
  "/app/fichajes": "Fichajes",
  "/app/empleados": "Equipo",
  "/app/necesidades": "Necesidades",
  "/app/ajustes": "Ajustes",
};
