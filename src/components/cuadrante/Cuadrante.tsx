"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useConfirm, useToast } from "@/components/feedback";
import { ui } from "@/components/ui";
import { ABSENCE_LABELS, rowsToGrid, type AbsenceReason, type TurnoRow } from "@/lib/data/mappers";
import { DAY_LONG, DAY_SHORT, dayOfMonth, isoWeekNumber, weekRangeLabel } from "@/lib/dates";
import { roleMap, roleStyle, type Role } from "@/lib/roles";
import { emptyGrid, findGaps, findIssues, generateSchedule, hoursByEmployee } from "@/lib/schedule";
import type { AbsenceMap, Code, Demand, Employee, Grid, IssueKind, Rules, ShiftCatalog, Slot } from "@/lib/schedule/types";
import { NotifyDialog, type NotifyEmployee } from "./NotifyDialog";

export type WeekStatus = "borrador" | "publicado" | "cambios";
type Result = { ok: true } | { ok: false; error: string };
type TurnosResult = { ok: true; turnos: TurnoRow[] } | { ok: false; error: string };

export interface CuadranteEmployee extends Employee {
  phone?: string | null;
  token?: string;
}

export interface CuadranteRequest {
  id: string;
  tipo: "librar" | "intercambio";
  dia: number;
  mensaje: string | null;
  empleadoId: string;
  conEmpleadoId: string | null;
}

/** Funciones del servidor. Sin ellas (la demo) todo funciona solo en memoria. */
export interface Persistence {
  save: (grid: Grid) => Promise<Result>;
  publish: () => Promise<Result>;
  acceptRequest: (id: string) => Promise<TurnosResult>;
  rejectRequest: (id: string) => Promise<Result>;
  copyPrevious?: () => Promise<TurnosResult>;
}

interface Props {
  employees: CuadranteEmployee[];
  roles: Role[];
  demand: Demand;
  shifts: ShiftCatalog;
  rules: Rules;
  monday: string;
  initialGrid?: Grid;
  absences?: AbsenceMap;
  initialStatus?: WeekStatus;
  persistence?: Persistence;
  requests?: CuadranteRequest[];
  notify?: { baseUrl: string; localName: string };
  nav?: { prev: string; next: string; today: string; isCurrent: boolean };
  onboarding?: { anyPublished: boolean; previousWeekHasShifts: boolean };
}

interface Selection {
  id: string;
  day: number;
  rect: { top: number; bottom: number; left: number; width: number };
}

const SLOT_NAME: Record<Slot, string> = { M: "mañana", T: "tarde", N: "noche" };

const STATUS_CHIP: Record<WeekStatus, { label: string; cls: string }> = {
  borrador: { label: "Borrador", cls: "bg-[#ECEAE3] text-ink-soft" },
  publicado: { label: "Publicado", cls: "bg-ok-soft text-accent" },
  cambios: { label: "Cambios sin publicar", cls: "bg-pending-soft text-pending-ink" },
};

const COLS =
  "grid grid-cols-[120px_repeat(7,minmax(92px,1fr))_74px] gap-1.5 sm:grid-cols-[176px_repeat(7,minmax(104px,1fr))_88px]";
const ABSENT_BG = "bg-[repeating-linear-gradient(135deg,#F2F0EA_0_6px,#E7E4DB_6px_12px)]";

export function Cuadrante(props: Props) {
  const { employees, roles, demand, shifts, rules, monday, persistence, notify, nav, onboarding } = props;
  const absences = useMemo(() => props.absences ?? {}, [props.absences]);
  const ids = useMemo(() => employees.map((e) => e.id), [employees]);
  const roleById = useMemo(() => roleMap(roles), [roles]);

  const [grid, setGrid] = useState<Grid>(
    () => props.initialGrid ?? generateSchedule(employees, demand, shifts, rules, absences),
  );
  const [status, setStatus] = useState<WeekStatus>(props.initialStatus ?? "borrador");
  const [requests, setRequests] = useState<CuadranteRequest[]>(props.requests ?? []);
  const [sel, setSel] = useState<Selection | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [busy, setBusy] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [publishedNow, setPublishedNow] = useState(false);
  const toast = useToast(6000);
  const { confirm, view: confirmView } = useConfirm();

  // Cola de guardado: los guardados se hacen en orden y solo cuenta el último.
  const queue = useRef<Promise<void>>(Promise.resolve());
  const seq = useRef(0);
  const latestGrid = useRef(grid);
  const lastSaveOk = useRef(true);

  useEffect(() => {
    if (saveState !== "saving") return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saveState]);

  // El editor flotante se cierra al desplazar la página o con Escape.
  useEffect(() => {
    if (!sel) return;
    const close = () => setSel(null);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [sel]);

  const gaps = useMemo(() => findGaps(grid, employees, demand), [grid, employees, demand]);
  const issues = useMemo(() => findIssues(grid, employees, shifts, rules, absences), [grid, employees, shifts, rules, absences]);
  const hours = useMemo(() => hoursByEmployee(grid, employees, shifts), [grid, employees, shifts]);
  const byId = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);
  const badCells = useMemo(() => {
    const s = new Set<string>();
    for (const i of issues) for (const d of i.days) s.add(`${i.employeeId}:${d}`);
    return s;
  }, [issues]);

  const totalGaps = gaps.reduce((a, g) => a + g.missing, 0);
  const warningCount = gaps.length + issues.length;
  const isEmpty = ids.every((id) => grid[id]?.every((c) => c === "L"));
  const demandTotal = demand.reduce((a, d) => a + Object.values(d).reduce((x, byRole) => x + Object.values(byRole ?? {}).reduce((y, n) => y + n, 0), 0), 0);
  const hasAbsences = Object.values(absences).some((w) => w.some(Boolean));

  const issueText: Record<IssueKind, string> = {
    "consecutive-nights": `cierra más de ${rules.maxConsecutiveNights} ${rules.maxConsecutiveNights === 1 ? "noche seguida" : "noches seguidas"}.`,
    "short-rest": `descansa menos de ${rules.minRestHours} h entre dos jornadas.`,
    "absence-conflict": "tiene un turno un día que está ausente.",
    "outside-availability": "tiene un turno fuera de su disponibilidad.",
    "too-few-days-off": `libra menos de ${rules.minDaysOff} ${rules.minDaysOff === 1 ? "día" : "días"} esta semana.`,
    "over-contract": "supera sus horas de contrato.",
  };

  const persist = useCallback(
    (next: Grid) => {
      latestGrid.current = next;
      if (!persistence) return;
      const mySeq = ++seq.current;
      setSaveState("saving");
      queue.current = queue.current.then(async () => {
        const res = await persistence.save(next).catch(() => ({ ok: false as const, error: "Sin conexión" }));
        if (mySeq === seq.current) {
          lastSaveOk.current = res.ok;
          setSaveState(res.ok ? "saved" : "error");
        }
      });
    },
    [persistence],
  );

  function commit(next: Grid) {
    setGrid(next);
    setStatus((s) => (s === "borrador" ? "borrador" : "cambios"));
    persist(next);
  }

  /** Cambio grande (generar, copiar, vaciar) con opción de deshacer. */
  function commitWithUndo(next: Grid, message: string) {
    const previous = grid;
    commit(next);
    setSel(null);
    toast.show({ message, action: { label: "Deshacer", onClick: () => commit(previous) } });
  }

  function setCell(id: string, day: number, code: Code) {
    commit({ ...grid, [id]: grid[id].map((c, d) => (d === day ? code : c)) });
    setSel(null);
  }

  function openCell(id: string, day: number, el: HTMLElement) {
    const r = el.getBoundingClientRect();
    setSel({ id, day, rect: { top: r.top, bottom: r.bottom, left: r.left, width: r.width } });
  }

  function focusCell(id: string, day: number) {
    const el = document.querySelector<HTMLElement>(`[data-cell="${id}:${day}"]`);
    if (!el) return;
    el.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
    setTimeout(() => openCell(id, day, el), 350);
  }

  async function regenerate() {
    setMenuOpen(false);
    commitWithUndo(generateSchedule(employees, demand, shifts, rules, absences), "Cuadrante generado con las reglas, necesidades y ausencias de esta semana.");
  }

  async function clearWeek() {
    setMenuOpen(false);
    const ok = await confirm({ title: "¿Vaciar la semana?", body: "Todas las casillas pasarán a Libre. Podrás deshacerlo justo después.", confirmLabel: "Vaciar", danger: true });
    if (ok) commitWithUndo(emptyGrid(employees), "Semana vaciada.");
  }

  async function copyPrevious() {
    setMenuOpen(false);
    if (!persistence?.copyPrevious) return;
    if (!isEmpty) {
      const ok = await confirm({ title: "¿Copiar la semana anterior?", body: "Se sustituirán los turnos de esta semana por los de la anterior. Podrás deshacerlo.", confirmLabel: "Copiar" });
      if (!ok) return;
    }
    setBusy(true);
    await queue.current;
    const previous = grid;
    const res = await persistence.copyPrevious();
    setBusy(false);
    if (!res.ok) return toast.show({ message: res.error, tone: "error" });
    const next = rowsToGrid(ids, res.turnos);
    setGrid(next);
    latestGrid.current = next;
    setStatus((s) => (s === "borrador" ? "borrador" : "cambios"));
    toast.show({ message: "Semana anterior copiada.", action: { label: "Deshacer", onClick: () => commit(previous) } });
  }

  async function publish() {
    if (status === "publicado" || busy) return;
    setBusy(true);
    setSel(null);
    toast.hide(); // el «Deshacer» de antes ya no tiene sentido una vez publicado
    try {
      if (persistence) {
        await queue.current; // primero, que termine cualquier guardado pendiente
        if (!lastSaveOk.current || saveState === "idle") {
          const retry = await persistence.save(latestGrid.current);
          lastSaveOk.current = retry.ok;
          if (!retry.ok) return toast.show({ message: "No se ha podido guardar el cuadrante. Revisa tu conexión.", tone: "error" });
          setSaveState("saved");
        }
        const res = await persistence.publish();
        if (!res.ok) return toast.show({ message: res.error, tone: "error" });
      }
      setStatus("publicado");
      setPublishedNow(true);
      if (notify) setNotifyOpen(true);
      else toast.show(`Publicado: ${employees.length} personas recibirían su horario.${totalGaps ? ` Quedan ${totalGaps} huecos.` : ""}`);
    } finally {
      setBusy(false);
    }
  }

  async function accept(r: CuadranteRequest) {
    if (!persistence) return;
    setBusy(true);
    await queue.current;
    const res = await persistence.acceptRequest(r.id);
    setBusy(false);
    if (!res.ok) return toast.show({ message: res.error, tone: "error" });
    const next = rowsToGrid(ids, res.turnos);
    setGrid(next);
    latestGrid.current = next;
    setStatus((s) => (s === "borrador" ? "borrador" : "cambios"));
    setRequests((rs) => rs.filter((x) => x.id !== r.id));
    toast.show("Cambio aplicado. Publica para que lo vea el equipo.");
  }

  async function reject(r: CuadranteRequest) {
    if (!persistence) return;
    const res = await persistence.rejectRequest(r.id);
    if (!res.ok) return toast.show({ message: res.error, tone: "error" });
    setRequests((rs) => rs.filter((x) => x.id !== r.id));
    toast.show(`Solicitud rechazada. Díselo a ${byId.get(r.empleadoId)?.name ?? "la persona"}.`);
  }

  // "09:00" → "09", "17:30" → "17:30": cabe en una línea y se lee de un vistazo.
  const hhmm = (t: string) => (t.endsWith(":00") ? t.slice(0, 2) : t);
  const fmt = (c: Slot) => `${hhmm(shifts[c].start)}–${hhmm(shifts[c].end)} h`;

  if (employees.length === 0) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-16 text-center">
        <h1 className={ui.h1}>Primero, tu equipo</h1>
        <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-ink-soft">
          Para generar el cuadrante necesito saber quién trabaja contigo, sus horas de contrato y cuándo puede trabajar cada uno.
        </p>
        <Link href="/app/empleados" className={`${ui.btn} ${ui.primary} mt-7`}>
          Añadir a mi equipo
        </Link>
      </main>
    );
  }

  const notifyList: NotifyEmployee[] = employees.map((e) => ({
    id: e.id,
    name: e.name,
    phone: e.phone ?? null,
    token: e.token ?? "",
    row: grid[e.id],
  }));

  const showFirstSteps = onboarding && !onboarding.anyPublished && !publishedNow;

  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-8 sm:py-8 print:max-w-none print:p-0">
      {/* ---------- Cabecera ---------- */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-1.5 flex flex-wrap items-center gap-2.5">
            <span className="text-[13px] font-medium uppercase tracking-[0.08em] text-ink-muted">Semana {isoWeekNumber(monday)}</span>
            <span className={`rounded-full px-2.5 py-0.5 text-[13px] font-semibold print:hidden ${STATUS_CHIP[status].cls}`}>{STATUS_CHIP[status].label}</span>
            {persistence && (
              <span className="text-[13px] text-ink-muted print:hidden" aria-live="polite">
                {saveState === "saving" && "Guardando…"}
                {saveState === "saved" && "✓ Guardado"}
                {saveState === "error" && (
                  <button onClick={() => persist(latestGrid.current)} className="font-semibold text-danger-ink underline">
                    No se pudo guardar · Reintentar
                  </button>
                )}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {nav && (
              <Link href={nav.prev} aria-label="Semana anterior" className="flex h-10 w-10 flex-none items-center justify-center rounded-[10px] border border-line-strong bg-surface text-lg hover:border-ink print:hidden">
                ‹
              </Link>
            )}
            <h1 className="font-display text-[28px] font-bold leading-tight tracking-tight sm:text-[34px]">{weekRangeLabel(monday)}</h1>
            {nav && (
              <Link href={nav.next} aria-label="Semana siguiente" className="flex h-10 w-10 flex-none items-center justify-center rounded-[10px] border border-line-strong bg-surface text-lg hover:border-ink print:hidden">
                ›
              </Link>
            )}
            {nav && !nav.isCurrent && (
              <Link href={nav.today} className="ml-1 text-sm font-semibold text-accent underline-offset-2 hover:underline print:hidden">
                Hoy
              </Link>
            )}
          </div>
        </div>

        <div className="grid w-full grid-cols-[auto_1fr] gap-2 sm:flex sm:w-auto sm:items-center print:hidden">
          <div className="relative">
            <button onClick={() => setMenuOpen((o) => !o)} aria-expanded={menuOpen} aria-haspopup="menu" className={`${ui.btn} ${ui.secondary} px-4`}>
              Más ▾
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                <div role="menu" className="absolute left-0 z-40 sm:left-auto sm:right-0 mt-2 w-64 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-lg">
                  {persistence?.copyPrevious && (
                    <MenuItem onClick={copyPrevious} disabled={!onboarding?.previousWeekHasShifts} hint={onboarding?.previousWeekHasShifts ? undefined : "La semana anterior está vacía"}>
                      Copiar semana anterior
                    </MenuItem>
                  )}
                  <MenuItem onClick={clearWeek} disabled={isEmpty}>
                    Vaciar semana
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      setMenuOpen(false);
                      setTimeout(() => window.print(), 50);
                    }}
                  >
                    Imprimir para el tablón
                  </MenuItem>
                </div>
              </>
            )}
          </div>
          <button onClick={regenerate} disabled={busy} className={`${ui.btn} ${ui.secondary}`}>
            Generar automáticamente
          </button>
          <button onClick={publish} disabled={busy || status === "publicado"} className={`${ui.btn} ${ui.primary} col-span-2`}>
            {busy ? "Un momento…" : status === "publicado" ? "Publicado ✓" : status === "cambios" ? "Publicar cambios" : "Publicar y avisar"}
          </button>
        </div>
      </div>

      {showFirstSteps && (
        <FirstSteps
          steps={[
            { done: employees.length > 0, label: "Añade a tu equipo", detail: `${employees.length} ${employees.length === 1 ? "persona" : "personas"}`, href: "/app/empleados" },
            { done: demandTotal > 0, label: "Indica cuánta gente necesitas", detail: demandTotal ? `${demandTotal} turnos por semana` : "Aún sin configurar", href: "/app/necesidades" },
            { done: !isEmpty, label: "Genera el cuadrante", detail: isEmpty ? "Pulsa «Generar automáticamente»" : "Hecho. Retoca lo que quieras" },
            { done: false, label: "Publica y avisa a tu equipo", detail: "Cada uno recibe su horario por WhatsApp" },
          ]}
        />
      )}

      <div className="flex flex-wrap items-start gap-6">
        {/* ---------- Cuadrícula ---------- */}
        <section aria-label="Cuadrante" className={`${ui.card} min-w-0 flex-[999_1_720px] p-3 sm:p-4 print:border-0 print:p-0`}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1 print:hidden">
            <div className="flex flex-wrap gap-3 text-[13px] text-ink-soft">
              {roles.map((r) => (
                <span key={r.key} className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-[4px]" style={{ backgroundColor: roleStyle(r.color).backgroundColor, boxShadow: `inset 0 0 0 1px ${roleStyle(r.color).color}33` }} />
                  {r.name}
                </span>
              ))}
              {hasAbsences && (
                <span className="flex items-center gap-1.5">
                  <span className={`h-3 w-3 rounded-[4px] ${ABSENT_BG}`} />
                  Ausencia
                </span>
              )}
            </div>
            <span className="text-[13px] text-ink-muted">Toca una casilla para cambiarla</span>
          </div>

          <div className="overflow-x-auto">
            <div className="flex min-w-[880px] flex-col gap-1.5 p-1 sm:min-w-[1010px]">
              <div className={`${COLS} pb-1 text-[13px] font-semibold text-ink-muted`}>
                <div className="sticky left-0 z-10 bg-surface">Persona</div>
                {DAY_SHORT.map((d, i) => (
                  <div key={d} className={i >= 5 ? "text-ink-soft" : ""}>
                    {d} <span className="font-normal">{dayOfMonth(monday, i)}</span>
                  </div>
                ))}
                <div className="text-right">Horas</div>
              </div>

              {employees.map((e) => {
                const diff = hours[e.id] - e.contractHours;
                const role = roleById[e.role];
                return (
                  <div key={e.id} className={COLS}>
                    <div className="sticky left-0 z-10 flex flex-col justify-center bg-surface pr-2">
                      <div className="truncate text-[15px] font-semibold">{e.name}</div>
                      <div className="truncate text-xs text-ink-muted">{role?.name ?? e.role}</div>
                    </div>
                    {grid[e.id].map((c, d) => {
                      const absent = absences[e.id]?.[d] as AbsenceReason | null | undefined;
                      const isSel = sel?.id === e.id && sel.day === d;
                      const bad = badCells.has(`${e.id}:${d}`);
                      const base = "flex min-h-[58px] w-full flex-col justify-center gap-0.5 rounded-[10px] px-2.5 py-2 text-left text-[13px] leading-tight transition hover:-translate-y-px hover:shadow-md";
                      const look = c !== "L" ? "" : absent ? `${ABSENT_BG} text-ink-soft` : "border border-dashed border-[#CFCBC0] bg-surface text-[#8A877F]";
                      return (
                        <button
                          key={d}
                          data-cell={`${e.id}:${d}`}
                          onClick={(ev) => openCell(e.id, d, ev.currentTarget)}
                          aria-label={`${e.name}, ${DAY_LONG[d]}: ${c === "L" ? (absent ? ABSENCE_LABELS[absent] : "libre") : shifts[c].label}`}
                          style={c !== "L" ? roleStyle(role?.color) : undefined}
                          className={`${base} ${look} ${bad ? "ring-2 ring-inset ring-danger" : ""} ${isSel ? "outline outline-[3px] outline-offset-2 outline-ink" : ""}`}
                        >
                          {c === "L" ? (
                            <strong className="text-sm font-semibold">{absent ? ABSENCE_LABELS[absent] : "Libre"}</strong>
                          ) : (
                            <>
                              <strong className="whitespace-nowrap text-[15px] font-semibold">{fmt(c)}</strong>
                              <span className={absent ? "font-semibold text-danger-ink" : "opacity-80"}>
                                {absent ? `⚠ ${ABSENCE_LABELS[absent]}` : shifts[c].label}
                              </span>
                            </>
                          )}
                        </button>
                      );
                    })}
                    <div className="flex flex-col items-end justify-center text-sm">
                      <span className={diff === 0 ? "font-semibold text-accent" : diff > 0 ? "font-semibold text-danger" : "text-ink-soft"}>
                        {hours[e.id]}/{e.contractHours} h
                      </span>
                      <span className="text-xs text-ink-muted">{diff === 0 ? "Cuadra" : diff > 0 ? `+${diff} h` : `−${-diff} h`}</span>
                    </div>
                  </div>
                );
              })}

              <div className={`${COLS} mt-1 border-t border-[#EEEBE3] pt-2 print:hidden`}>
                <div className="sticky left-0 z-10 flex items-center bg-surface text-[13px] font-semibold text-ink-soft">Cobertura</div>
                {DAY_SHORT.map((_, d) => {
                  const miss = gaps.filter((g) => g.day === d).reduce((a, g) => a + g.missing, 0);
                  return (
                    <div key={d} className={`rounded-lg px-2 py-1.5 text-center text-xs font-semibold ${miss ? "bg-danger-soft text-danger-ink" : "bg-ok-soft text-accent"}`}>
                      {miss ? `Falta${miss > 1 ? `n ${miss}` : " 1"}` : "✓ Completo"}
                    </div>
                  );
                })}
                <div />
              </div>
            </div>
          </div>
        </section>

        {/* ---------- Panel lateral ---------- */}
        <aside className="flex w-full flex-col gap-4 lg:w-auto lg:flex-[1_1_300px] print:hidden">
          <div className={`${ui.card} p-5`}>
            <h2 className={`${ui.h2} mb-3`}>
              {warningCount === 0 ? "Todo en orden" : warningCount === 1 ? "1 cosa por revisar" : `${warningCount} cosas por revisar`}
            </h2>
            {warningCount === 0 ? (
              <p className="text-sm leading-relaxed text-accent">Todo cubierto y dentro de las reglas. Listo para publicar.</p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm leading-snug">
                {gaps.map((g) => (
                  <li key={`g-${g.day}-${g.slot}-${g.role}`} className="flex gap-2.5 rounded-lg px-2 py-2">
                    <Dot />
                    <span>
                      <strong>
                        {DAY_SHORT[g.day]} {dayOfMonth(monday, g.day)} · {SLOT_NAME[g.slot]}:
                      </strong>{" "}
                      falta{g.missing > 1 ? `n ${g.missing}` : " 1"} en {(roleById[g.role]?.name ?? g.role).toLowerCase()}.
                    </span>
                  </li>
                ))}
                {issues.map((i) => (
                  <li key={`i-${i.employeeId}-${i.kind}`}>
                    <button
                      onClick={() => i.days.length && focusCell(i.employeeId, i.days[0])}
                      disabled={!i.days.length}
                      className="flex w-full gap-2.5 rounded-lg px-2 py-2 text-left enabled:hover:bg-ground"
                    >
                      <Dot />
                      <span>
                        <strong>{byId.get(i.employeeId)?.name}</strong> {issueText[i.kind]}
                        {i.days.length > 0 && <span className="ml-1 text-ink-muted">Ver →</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {persistence && (
            <div className={`${ui.card} p-5`}>
              <h2 className={`${ui.h2} mb-3`}>Solicitudes de cambio</h2>
              {requests.length === 0 ? (
                <p className="text-sm text-ink-muted">Nadie ha pedido cambios esta semana.</p>
              ) : (
                <div className="flex flex-col gap-4">
                  {requests.map((r) => {
                    const who = byId.get(r.empleadoId)?.name ?? "Alguien";
                    const day = `el ${DAY_LONG[r.dia]} ${dayOfMonth(monday, r.dia)}`;
                    const what = r.tipo === "librar" ? `pide librar ${day}.` : `quiere cambiarse ${day} con ${byId.get(r.conEmpleadoId ?? "")?.name ?? "un compañero"}.`;
                    return (
                      <div key={r.id} className="border-t border-[#EEEBE3] pt-3.5 text-sm leading-snug first:border-0 first:pt-0">
                        <div>
                          <strong>{who}</strong> {what}
                        </div>
                        {r.mensaje && <p className="mt-1 text-ink-soft">“{r.mensaje}”</p>}
                        <div className="mt-2.5 flex gap-2">
                          <button onClick={() => accept(r)} disabled={busy} className={`${ui.btnSm} ${ui.primary}`}>
                            Aceptar
                          </button>
                          <button onClick={() => reject(r)} disabled={busy} className={`${ui.btnSm} ${ui.secondary}`}>
                            Rechazar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </aside>
      </div>

      {sel && byId.get(sel.id) && (
        <CellEditor
          sel={sel}
          employee={byId.get(sel.id)!}
          current={grid[sel.id][sel.day]}
          absent={(absences[sel.id]?.[sel.day] as AbsenceReason | null) ?? null}
          monday={monday}
          shifts={shifts}
          onPick={(code) => setCell(sel.id, sel.day, code)}
          onClose={() => setSel(null)}
        />
      )}

      {notify && notifyOpen && (
        <NotifyDialog
          employees={notifyList}
          shifts={shifts}
          monday={monday}
          baseUrl={notify.baseUrl}
          localName={notify.localName}
          gaps={totalGaps}
          onClose={() => setNotifyOpen(false)}
        />
      )}
      {toast.view}
      {confirmView}
    </main>
  );
}

function Dot() {
  return <span className="mt-[7px] h-2 w-2 flex-none rounded-full bg-danger" aria-hidden="true" />;
}

function MenuItem({ children, onClick, disabled, hint }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; hint?: string }) {
  return (
    <button role="menuitem" onClick={onClick} disabled={disabled} className="flex w-full flex-col px-4 py-2.5 text-left text-[15px] hover:bg-ground disabled:cursor-not-allowed disabled:opacity-50">
      {children}
      {hint && <span className="text-xs text-ink-muted">{hint}</span>}
    </button>
  );
}

function FirstSteps({ steps }: { steps: { done: boolean; label: string; detail: string; href?: string }[] }) {
  const doneCount = steps.filter((s) => s.done).length;
  const nextIdx = steps.findIndex((s) => !s.done);
  return (
    <section aria-label="Primeros pasos" className={`${ui.card} mb-5 p-4 sm:p-5 print:hidden`}>
      <div className="mb-3 flex items-center justify-between gap-3 sm:mb-4">
        <h2 className={ui.h2}>Primeros pasos</h2>
        <span className="text-sm text-ink-muted">
          {doneCount} de {steps.length}
        </span>
      </div>
      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-ground sm:hidden" aria-hidden>
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
      </div>
      {/* En el móvil solo se ve el siguiente paso, para no empujar el cuadrante hacia abajo. */}
      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => {
          const content = (
            <>
              <span className={`flex h-7 w-7 flex-none items-center justify-center rounded-full text-sm font-bold ${s.done ? "bg-accent text-white" : "border-2 border-line-strong text-ink-muted"}`}>
                {s.done ? "✓" : i + 1}
              </span>
              <span className="min-w-0">
                <span className={`block text-[15px] font-semibold ${s.done ? "text-ink-soft line-through decoration-ink-muted/40" : ""}`}>{s.label}</span>
                <span className="block text-[13px] text-ink-muted">{s.detail}</span>
              </span>
            </>
          );
          return (
            <li key={s.label} className={i === nextIdx ? "" : "hidden sm:block"}>
              {s.href && !s.done ? (
                <Link href={s.href} className="flex h-full gap-3 rounded-xl border border-line p-3 hover:border-ink">
                  {content}
                </Link>
              ) : (
                <div className={`flex h-full gap-3 rounded-xl border p-3 ${s.done ? "border-transparent bg-ground" : "border-line"}`}>{content}</div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function CellEditor(props: {
  sel: Selection;
  employee: CuadranteEmployee;
  current: Code;
  absent: AbsenceReason | null;
  monday: string;
  shifts: ShiftCatalog;
  onPick: (code: Code) => void;
  onClose: () => void;
}) {
  const { sel, employee, current, absent, monday, shifts, onPick, onClose } = props;
  const firstRef = useRef<HTMLButtonElement>(null);
  // El editor solo se abre tras un clic (ya en el navegador), así que window existe.
  const [mobile] = useState(() => window.innerWidth < 640);

  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  // En escritorio, el editor aparece bajo la casilla (o encima, si no cabe).
  const W = 296;
  const H = 300;
  const style = mobile
    ? undefined
    : (() => {
        const below = sel.rect.bottom + 8 + H < window.innerHeight;
        const top = below ? sel.rect.bottom + 8 : Math.max(8, sel.rect.top - H - 8);
        const left = Math.min(Math.max(8, sel.rect.left + sel.rect.width / 2 - W / 2), window.innerWidth - W - 8);
        return { top, left, width: W };
      })();

  return (
    <>
      <div className={`fixed inset-0 z-40 ${mobile ? "bg-black/30" : ""}`} onClick={onClose} />
      <div
        role="dialog"
        aria-label={`Cambiar turno de ${employee.name}`}
        style={style}
        className={`fixed z-50 border border-line bg-surface p-4 shadow-xl ${mobile ? "inset-x-0 bottom-0 rounded-t-2xl pb-6" : "rounded-2xl"}`}
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <div className="text-[15px] font-semibold">{employee.name}</div>
            <div className="text-[13px] text-ink-muted">
              {DAY_LONG[sel.day]} {dayOfMonth(monday, sel.day)}
            </div>
          </div>
          <button aria-label="Cerrar" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted hover:bg-ground">
            ✕
          </button>
        </div>
        {absent && (
          <p className="mb-3 rounded-lg bg-pending-soft px-3 py-2 text-[13px] text-pending-ink">
            {employee.name} está de {ABSENCE_LABELS[absent].toLowerCase()} este día.
          </p>
        )}
        <div className="grid grid-cols-2 gap-2">
          {(["M", "T", "N", "L"] as Code[]).map((code, i) => {
            const available = code === "L" || (employee.availability[code][sel.day] && !absent);
            const isCurrent = current === code;
            return (
              <button
                key={code}
                ref={i === 0 ? firstRef : undefined}
                onClick={() => onPick(code)}
                className={`flex min-h-[60px] flex-col gap-0.5 rounded-xl px-3 py-2.5 text-left ${isCurrent ? "border-2 border-ink bg-ground" : "border border-line-strong hover:border-ink"}`}
              >
                <span className="text-[15px] font-semibold">{code === "L" ? "Libre" : shifts[code].label}</span>
                <small className={`text-xs ${available ? "text-ink-muted" : "text-danger-ink"}`}>
                  {code === "L" ? "No trabaja" : `${shifts[code].start}–${shifts[code].end}${available ? "" : " · no disponible"}`}
                </small>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
