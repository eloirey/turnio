"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { AvisosBell } from "@/components/avisos/AvisosBell";
import type { Aviso } from "@/lib/avisos";
import { GuidePanel, GuideWaiting, guideBtn, highlightTour } from "@/components/guide/GuidePanel";
import { Cuadrante, type Persistence } from "@/components/cuadrante/Cuadrante";
import { Logo } from "@/components/Logo";
import { NavProvider } from "@/components/nav";
import { ui } from "@/components/ui";
import { AjustesForms, type SettingsActions } from "@/app/app/ajustes/AjustesForms";
import { EmpleadosManager, type EmployeeActions } from "@/app/app/empleados/EmpleadosManager";
import { ClockIntro } from "@/app/app/fichajes/ClockIntro";
import { FichajesBoard, type ClockActions } from "@/app/app/fichajes/FichajesBoard";
import { NecesidadesEditor } from "@/app/app/necesidades/NecesidadesEditor";
import { OnboardingForm } from "@/app/bienvenida/OnboardingForm";
import { absencesForWeek } from "@/lib/data/mappers";
import { addDays, dayOfMonth, isValidISODate } from "@/lib/dates";
import { clockCsv, dayStatus, groupByEmployeeDay, madridToIso, type ClockRecord } from "@/lib/fichajes";
import { employeeSchema, firstError, necesidadesSchema, settingsSchema } from "@/lib/forms";
import { makeRoleKey } from "@/lib/roles";
import { toHours } from "@/lib/schedule/rules";
import { activeSlots, type Demand, type Grid } from "@/lib/schedule/types";
import { applyShifts, createDemoState, normalizeGrid, simulateClock, type DemoState, type DemoTab } from "./demo-store";

const NAV = [
  { href: "/app/cuadrante", label: "Cuadrante" },
  { href: "/app/fichajes", label: "Fichajes" },
  { href: "/app/empleados", label: "Equipo" },
  { href: "/app/necesidades", label: "Necesidades" },
  { href: "/app/ajustes", label: "Ajustes" },
];

const TAB_OF: Record<string, DemoTab> = {
  "/app/cuadrante": "cuadrante",
  "/app/fichajes": "fichajes",
  "/app/empleados": "empleados",
  "/app/necesidades": "necesidades",
  "/app/ajustes": "ajustes",
};

/** La demo completa: alta, equipo, necesidades, cuadrante y fichajes, todo en el navegador. */
export function DemoApp() {
  const [state, setState] = useState<DemoState | null>(null);
  const [tab, setTab] = useState<DemoTab>("empleados");
  const [step, setStep] = useState(0);
  const [guideHidden, setGuideHidden] = useState(false);
  const [avisosRead, setAvisosRead] = useState(false);
  // Copia síncrona del estado para que las acciones (asíncronas) lean siempre lo último.
  const stateRef = useRef<DemoState | null>(null);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  const pendingSim = useRef(false);

  const go = useCallback((href: string) => {
    const t = TAB_OF[href.split("?")[0]];
    if (t) {
      setTab(t);
      window.scrollTo({ top: 0 });
    }
  }, []);

  const update = (fn: (s: DemoState) => DemoState) => {
    const cur = stateRef.current;
    if (!cur) return;
    const nextState = fn(cur);
    stateRef.current = nextState;
    setState(nextState);
  };
  const next = <T,>(value: T) => Promise.resolve(value);

  // ---------- Acciones en memoria (mismas validaciones que el servidor) ----------
  const employeeActions: EmployeeActions = useMemo(
    () => ({
      saveEmployee: async (input) => {
        const s = stateRef.current!;
        const parsed = employeeSchema.safeParse({ ...input, id: undefined });
        if (!parsed.success) return next({ ok: false as const, error: firstError(parsed.error) });
        const d = parsed.data;
        if (!s.roles.some((r) => r.key === d.puesto)) return next({ ok: false as const, error: "Ese puesto no existe. Créalo en Ajustes." });
        const id = input.id ?? `demo-n${s.seq}`;
        const record = {
          id,
          name: d.nombre,
          role: d.puesto,
          contractHours: d.horasContrato,
          availability: d.availability,
          minDaysOff: d.minDaysOff ?? null,
          maxConsecutiveClosings: d.maxConsecutiveClosings ?? null,
          preferredDaysOff: d.preferredDaysOff ?? [],
          phone: d.telefono || null,
          token: input.id ? (s.employees.find((e) => e.id === id)?.token ?? "") : `${s.seq}`.padStart(32, "a"),
        };
        update((st) => {
          const exists = st.employees.some((e) => e.id === id);
          const employees = exists ? st.employees.map((e) => (e.id === id ? record : e)) : [...st.employees, record];
          return { ...st, employees, grid: normalizeGrid(st.grid, employees), seq: st.seq + 1 };
        });
        return next({ ok: true as const, id });
      },
      deleteEmployee: async (id) => {
        update((st) => {
          const employees = st.employees.filter((e) => e.id !== id);
          return { ...st, employees, grid: normalizeGrid(st.grid, employees), absences: st.absences.filter((a) => a.empleado_id !== id), records: st.records.filter((r) => r.employeeId !== id) };
        });
        return next({ ok: true as const, id });
      },
      newLink: async (id) => {
        update((st) => ({ ...st, employees: st.employees.map((e) => (e.id === id ? { ...e, token: `${st.seq}`.padStart(32, "b") } : e)), seq: st.seq + 1 }));
        return next({ ok: true as const, id });
      },
      addAbsence: async (a) => {
        if (!isValidISODate(a.desde) || !isValidISODate(a.hasta)) return next({ ok: false as const, error: "Fecha no válida" });
        if (a.hasta < a.desde) return next({ ok: false as const, error: "La fecha de fin no puede ser anterior a la de inicio" });
        const id = `aus-${stateRef.current!.seq}`;
        update((st) => ({ ...st, absences: [...st.absences, { id, empleado_id: a.empleadoId, desde: a.desde, hasta: a.hasta, motivo: a.motivo, nota: a.nota || null }], seq: st.seq + 1 }));
        return next({ ok: true as const, id });
      },
      deleteAbsence: async (id) => {
        update((st) => ({ ...st, absences: st.absences.filter((a) => a.id !== id) }));
        return next({ ok: true as const, id });
      },
    }),
    [],
  );

  const settingsActions: SettingsActions = useMemo(
    () => ({
      saveSettings: async (input) => {
        const parsed = settingsSchema.safeParse(input);
        if (!parsed.success) return next({ ok: false as const, error: firstError(parsed.error) });
        const v = parsed.data;
        update((st) => ({
          ...st,
          name: v.nombre,
          rules: { maxConsecutiveNights: v.maxConsecutiveNights, minRestHours: v.minRestHours, minDaysOff: v.minDaysOff, maxExtraHours: v.maxExtraHours },
          settings: { clockIn: v.clockIn, clockMarginMinutes: v.clockMarginMinutes },
        }));
        return next({ ok: true as const });
      },
      saveRoles: async (list) => {
        const s = stateRef.current!;
        if (!list.length) return next({ ok: false as const, error: "Necesitas al menos un puesto" });
        if (list.some((r) => !r.name.trim())) return next({ ok: false as const, error: "Todos los puestos necesitan nombre" });
        const names = list.map((r) => r.name.trim().toLowerCase());
        if (new Set(names).size !== names.length) return next({ ok: false as const, error: "Hay dos puestos con el mismo nombre." });
        const keep = new Set(list.filter((r) => r.key).map((r) => r.key!));
        const inUse = s.roles.filter((r) => !keep.has(r.key) && s.employees.some((e) => e.role === r.key));
        if (inUse.length) return next({ ok: false as const, error: `No puedes quitar ${inUse.map((r) => `«${r.name}»`).join(", ")}: hay personas con ese puesto. Cámbiales el puesto primero.` });
        const used = s.roles.map((r) => r.key);
        const roles = list.map((r) => {
          const key = r.key && used.includes(r.key) ? r.key : makeRoleKey(r.name, used);
          if (!used.includes(key)) used.push(key);
          return { key, name: r.name.trim(), color: r.color };
        });
        const valid = new Set(roles.map((r) => r.key));
        update((st) => ({
          ...st,
          roles,
          demand: st.demand.map((day) => Object.fromEntries(Object.entries(day).map(([slot, byRole]) => [slot, Object.fromEntries(Object.entries(byRole ?? {}).filter(([k]) => valid.has(k)))]))),
        }));
        return next({ ok: true as const });
      },
    }),
    [],
  );

  const clockActions: ClockActions = useMemo(
    () => ({
      saveClock: async (c) => {
        const s = stateRef.current!;
        if (!c.reason || c.reason.trim().length < 2) return next({ ok: false as const, error: "Indica el motivo del cambio" });
        const start = madridToIso(c.date, c.start);
        const end = c.end ? madridToIso(toHours(c.end) <= toHours(c.start) ? addDays(c.date, 1) : c.date, c.end) : null;
        if (Date.parse(start) > Date.parse(s.now) || (end && Date.parse(end) > Date.parse(s.now))) return next({ ok: false as const, error: "No se pueden registrar horas futuras" });
        const overlaps = s.records.some(
          (r) =>
            r.employeeId === c.employeeId &&
            r.id !== c.id &&
            !r.missingEnd &&
            Date.parse(r.start) < (end ? Date.parse(end) : Infinity) &&
            Date.parse(start) < (r.end ? Date.parse(r.end) : Infinity),
        );
        if (overlaps) return next({ ok: false as const, error: "Se solapa con otro tramo de esta persona" });
        update((st) => {
          const before = c.id ? st.records.find((r) => r.id === c.id) : undefined;
          const id = c.id ?? `rec-n${st.seq}`;
          const rec: ClockRecord = { id, employeeId: c.employeeId, start, end, missingEnd: false, edited: true };
          return {
            ...st,
            seq: st.seq + 1,
            records: c.id ? st.records.map((r) => (r.id === c.id ? rec : r)) : [...st.records, rec],
            changes: [
              ...st.changes,
              {
                recordId: id,
                employeeId: c.employeeId,
                action: c.id ? "editar" : "crear",
                before: before ? { entrada: before.start, salida: before.end } : null,
                after: { entrada: start, salida: end },
                reason: c.reason.trim(),
                at: st.now,
              },
            ],
          };
        });
        return next({ ok: true as const });
      },
      deleteClock: async (id, reason) => {
        if (!reason || reason.trim().length < 2) return next({ ok: false as const, error: "Indica el motivo del cambio" });
        update((st) => {
          const r = st.records.find((x) => x.id === id);
          if (!r) return st;
          return {
            ...st,
            records: st.records.filter((x) => x.id !== id),
            changes: [...st.changes, { recordId: id, employeeId: r.employeeId, action: "borrar", before: { entrada: r.start, salida: r.end }, after: null, reason: reason.trim(), at: st.now }],
          };
        });
        return next({ ok: true as const });
      },
      exportClock: async (month) => {
        const s = stateRef.current!;
        const byDay = groupByEmployeeDay(s.records);
        const roleName = Object.fromEntries(s.roles.map((r) => [r.key, r.name]));
        const rows = [];
        for (let d = 0; d < 7; d++) {
          const date = addDays(s.monday, d);
          if (date > s.today || !date.startsWith(month)) continue;
          for (const e of s.employees) {
            const records = byDay.get(`${e.id}|${date}`) ?? [];
            const code = s.grid[e.id]?.[d];
            const shift = code && s.shifts[code] ? s.shifts[code] : null;
            if (!records.length && !shift) continue;
            rows.push({
              date,
              name: e.name,
              role: roleName[e.role] ?? e.role,
              records,
              planned: shift ? `${shift.label} ${shift.start}–${shift.end}` : "",
              status: dayStatus(date, records, shift, new Date(s.now), s.settings.clockMarginMinutes).kind,
              lastReason: [...s.changes].reverse().find((ch) => records.some((r) => r.id === ch.recordId))?.reason,
            });
          }
        }
        return next({ ok: true as const, csv: clockCsv(rows, new Date(s.now)), filename: `registro-jornada-demo-${month}.csv` });
      },
    }),
    [],
  );

  const persistence: Persistence = useMemo(
    () => ({
      save: async (grid: Grid) => {
        update((st) => {
          const records = pendingSim.current || (!st.records.length && Object.values(grid).some((r) => r.some((c) => c !== "L"))) ? simulateClock(st, grid) : st.records;
          pendingSim.current = false;
          return { ...st, grid, records, status: st.published ? "cambios" : "borrador" };
        });
        return { ok: true as const };
      },
      publish: async () => {
        update((st) => ({ ...st, status: "publicado", published: true }));
        return { ok: true as const };
      },
      acceptRequest: async () => ({ ok: false as const, error: "En la demo no hay solicitudes." }),
      rejectRequest: async () => ({ ok: false as const, error: "En la demo no hay solicitudes." }),
    }),
    [],
  );

  // ---------- Guía ----------
  const steps = guideSteps(state);
  const current = steps[Math.min(step, steps.length - 1)];

  useEffect(() => {
    if (!state || guideHidden || !current?.highlight || current.tab !== tab) return;
    return highlightTour(current.highlight);
  }, [state, guideHidden, current, tab]);

  function onCuadranteEvent(event: "generated" | "published" | "edited") {
    if (event === "generated") {
      pendingSim.current = true;
      if (step <= 2) setStep(3);
    }
    if (event === "published" && step <= 3) setStep(4);
  }

  // ---------- Pantallas ----------
  if (!state) {
    return (
      <main className="flex min-h-screen flex-col items-center gap-7 bg-ground px-4 py-10">
        <div className="max-w-2xl text-center">
          <div className="mb-6 flex justify-center">
            <Link href="/" aria-label="Rotafy, inicio">
              <Logo />
            </Link>
          </div>
          <span className="inline-flex rounded-full bg-pending-soft px-3 py-1 text-[13px] font-semibold text-pending-ink">Demo · no se guarda nada</span>
          <h1 className={`${ui.h1} mt-3`}>Prueba Rotafy con un negocio de ejemplo</h1>
          <p className="mt-2 text-[15px] text-ink-soft">
            Es exactamente lo que verás al crear tu cuenta. Elige el sector que más se parezca al tuyo y te montamos un equipo de ejemplo para que juegues.
          </p>
        </div>
        <OnboardingForm
          onCreate={(input) => {
            const fresh = createDemoState(input);
            stateRef.current = fresh;
            setState(fresh);
            setTab("empleados");
            setStep(0);
            window.scrollTo({ top: 0 });
          }}
        />
      </main>
    );
  }

  const ids = state.employees.map((e) => e.id);
  // Avisos de ejemplo para la campanita (en la app de verdad llegan solos).
  const someone = state.employees[2]?.name ?? state.employees[0]?.name ?? "Laura";
  const demoAvisosItems: Aviso[] = [
    { id: "d1", tipo: "solicitud", titulo: `${someone} pide librar el viernes ${dayOfMonth(state.monday, 4)}`, cuerpo: "Tengo médico por la mañana.", enlace: "/app/cuadrante", creadoEn: new Date(Date.parse(state.now) - 25 * 60_000).toISOString(), leido: avisosRead },
    { id: "d2", tipo: "anuncio", titulo: "Bienvenido a Rotafy", cuerpo: "Aquí te avisamos de las solicitudes de tu equipo, de quien olvide fichar la salida y de las novedades.", enlace: null, creadoEn: new Date(Date.parse(state.now) - 3 * 3_600_000).toISOString(), leido: avisosRead },
  ];
  const demoAvisos = { items: demoAvisosItems, unread: avisosRead ? 0 : demoAvisosItems.length };
  const grid = normalizeGrid(state.grid, state.employees);
  const usage = Object.fromEntries(state.roles.map((r) => [r.key, state.employees.filter((e) => e.role === r.key).length]));

  return (
    <NavProvider onNavigate={go}>
      <div className="min-h-screen bg-ground pb-40">
        <AppHeader
          localName={state.name}
          nav={NAV}
          activeHref={`/app/${tab}`}
          extra={
            <>
              <AvisosBell
                key={state.name}
                initial={demoAvisos}
                pollMs={0}
                load={async () => ({ ok: true as const, ...demoAvisos })}
                markRead={async () => setAvisosRead(true)}
                emptyText="No tienes avisos."
              />
              {guideHidden && (
                <button onClick={() => setGuideHidden(false)} className="min-h-10 rounded-lg px-3 font-semibold text-accent hover:bg-accent-soft">
                  Guía
                </button>
              )}
              <span className="hidden sm:block">
                <Link href="/login" className={`${ui.btnSm} ${ui.primary} h-10`}>
                  Crear cuenta gratis
                </Link>
              </span>
            </>
          }
        />
        <div className="mx-auto max-w-[1400px] px-4 pt-4 sm:px-8">
          <p className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-pending-soft px-4 py-2.5 text-sm text-pending-ink">
            <span>
              <strong>Demo:</strong> todo funciona de verdad, pero nada se guarda al cerrar la página.
            </span>
            <button onClick={() => setState(null)} className="font-semibold underline underline-offset-2">
              Empezar de nuevo
            </button>
          </p>
        </div>

        {tab === "empleados" && (
          <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-8 sm:py-8">
            <EmpleadosManager
              employees={state.employees}
              roles={state.roles}
              shifts={state.shifts}
              rules={state.rules}
              absences={state.absences}
              today={state.today}
              baseUrl="https://rotafy.es"
              localName={state.name}
              firstTime={false}
              actions={employeeActions}
            />
          </main>
        )}
        {tab === "necesidades" && (
          <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-8 sm:py-8">
            <NecesidadesEditor
              key={JSON.stringify(state.roles.map((r) => r.key))}
              initialDemand={state.demand}
              initialShifts={state.shifts}
              roles={state.roles}
              onSave={async (input) => {
                const parsed = necesidadesSchema.safeParse(input);
                if (!parsed.success) return { ok: false as const, error: firstError(parsed.error) };
                update((st) => applyShifts(st, parsed.data.shifts, parsed.data.demand as Demand));
                return { ok: true as const };
              }}
            />
          </main>
        )}
        {tab === "ajustes" && (
          <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-8 sm:py-8">
            <h1 className={`${ui.h1} mb-6`}>Ajustes</h1>
            <AjustesForms localName={state.name} roles={state.roles} rules={state.rules} settings={state.settings} usage={usage} actions={settingsActions} />
          </main>
        )}
        {tab === "cuadrante" && (
          <Cuadrante
            employees={state.employees}
            roles={state.roles}
            demand={state.demand}
            shifts={state.shifts}
            rules={state.rules}
            monday={state.monday}
            initialGrid={grid}
            absences={absencesForWeek(state.absences, state.monday)}
            initialStatus={state.status}
            persistence={persistence}
            notify={{ baseUrl: "https://rotafy.es", localName: state.name }}
            onboarding={{ anyPublished: state.published, previousWeekHasShifts: false }}
            clock={state.settings.clockIn ? { records: state.records, now: state.now, marginMinutes: state.settings.clockMarginMinutes, today: state.today } : undefined}
            onEvent={onCuadranteEvent}
          />
        )}
        {tab === "fichajes" &&
          (state.settings.clockIn ? (
            <FichajesBoard
              people={state.employees.map((e) => ({ id: e.id, name: e.name, role: e.role }))}
              roles={state.roles}
              shifts={state.shifts}
              records={state.records}
              planned={ids.flatMap((id) => (grid[id] ?? []).flatMap((c, d) => (c !== "L" ? [{ employeeId: id, date: addDays(state.monday, d), slot: c }] : [])))}
              changes={state.changes}
              monday={state.monday}
              today={state.today}
              now={state.now}
              marginMinutes={state.settings.clockMarginMinutes}
              actions={clockActions}
              onChanged={() => {}}
            />
          ) : (
            <ClockIntro onActivate={() => update((st) => ({ ...st, settings: { ...st.settings, clockIn: true } }))} />
          ))}

        {!guideHidden && current && (
          <GuidePanel
            index={Math.min(step, steps.length - 1)}
            total={steps.length}
            title={current.title}
            body={current.body}
            onHide={() => setGuideHidden(true)}
            onBack={() => {
              const n = Math.max(0, step - 1);
              setStep(n);
              go(`/app/${steps[n].tab}`);
            }}
            action={
              current.final ? (
                <Link href="/login" className={`${ui.btn} bg-white text-ink hover:bg-ground`}>
                  Crear mi cuenta gratis
                </Link>
              ) : tab !== current.tab ? (
                <button onClick={() => go(`/app/${current.tab}`)} className={guideBtn}>
                  Ir a {TAB_LABEL[current.tab]}
                </button>
              ) : current.cta ? (
                <button
                  onClick={() => {
                    const n = Math.min(step + 1, steps.length - 1);
                    setStep(n);
                    go(`/app/${steps[n].tab}`);
                  }}
                  className={guideBtn}
                >
                  {current.cta} →
                </button>
              ) : (
                <GuideWaiting />
              )
            }
          />
        )}
      </div>
    </NavProvider>
  );
}

// ---------- Guía paso a paso ----------

interface GuideStep {
  tab: DemoTab;
  title: string;
  body: string;
  /** Botón para avanzar (si no, se avanza haciendo la acción). */
  cta?: string;
  /** Elemento a destacar (atributo data-tour). */
  highlight?: string;
  final?: boolean;
}

function guideSteps(state: DemoState | null): GuideStep[] {
  const n = state?.employees.length ?? 0;
  const slots = state ? activeSlots(state.shifts).map((c) => state.shifts[c].label) : [];
  return [
    {
      tab: "empleados",
      title: "Este es tu equipo",
      body: `Hemos creado ${n} personas de ejemplo. Toca a cualquiera para ver su puesto, sus horas y cuándo puede trabajar. Prueba «+ Añadir persona» o «Personalizar» para darle días libres preferidos.`,
      cta: "Siguiente: necesidades",
    },
    {
      tab: "necesidades",
      title: "Cuánta gente necesitas",
      body: `Para cada franja (${slots.slice(0, 3).join(", ")}${slots.length > 3 ? "…" : ""}) y día, cuántas personas de cada puesto. Abajo puedes renombrar franjas, cambiar horarios o añadir otra. Recuerda pulsar «Guardar».`,
      cta: "Siguiente: el cuadrante",
    },
    {
      tab: "cuadrante",
      title: "Genera el cuadrante",
      body: "Pulsa «Generar automáticamente». Rotafy reparte los turnos respetando disponibilidad, contratos, ausencias y descansos de 12 h.",
      highlight: "generar",
    },
    {
      tab: "cuadrante",
      title: "Retoca y publica",
      body: "Toca cualquier casilla para cambiarla: si rompes una regla, la verás en rojo y en el panel de la derecha. Debajo de los turnos ya pasados verás lo que fichó cada uno. Cuando te guste, pulsa «Publicar y avisar».",
      highlight: "publicar",
    },
    {
      tab: "cuadrante",
      title: "Así avisas a tu equipo",
      body: "Cada persona recibe por WhatsApp o Telegram su horario y su enlace personal, donde lo consulta, ficha y lo añade a su calendario. Sin instalar nada. El enlace es único de cada uno y no se comparte: si se pierde, lo cambias desde Equipo.",
      cta: "Siguiente: fichajes",
    },
    {
      tab: "fichajes",
      title: "Los fichajes del equipo",
      body: "Quién está trabajando, las horas de cada uno y lo que hay que revisar. Toca un día marcado en rojo para corregir un olvido: queda guardado con su motivo, como pide la ley.",
      cta: "Terminar",
    },
    {
      tab: "fichajes",
      title: "¡Ya sabes usar Rotafy!",
      body: "Con tu equipo real lo tendrás listo en 10 minutos. Crea tu cuenta gratis: sin tarjeta.",
      final: true,
    },
  ];
}

const TAB_LABEL: Record<DemoTab, string> = { cuadrante: "Cuadrante", fichajes: "Fichajes", empleados: "Equipo", necesidades: "Necesidades", ajustes: "Ajustes" };
