"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ui } from "@/components/ui";
import { rowsToGrid, type TurnoRow } from "@/lib/data/mappers";
import { DAY_LONG, DAY_SHORT, dayOfMonth, isoWeekNumber, weekRangeLabel } from "@/lib/dates";
import { ROLE_STYLES } from "@/lib/roles";
import { findGaps, findIssues, generateSchedule, hoursByEmployee } from "@/lib/schedule";
import type { Code, Demand, Employee, Grid, IssueKind, Rules, ShiftCatalog, Slot } from "@/lib/schedule/types";
import { NotifyDialog, type NotifyEmployee } from "./NotifyDialog";

export type WeekStatus = "borrador" | "publicado" | "cambios";
type Result = { ok: true } | { ok: false; error: string };

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
  acceptRequest: (id: string) => Promise<{ ok: true; turnos: TurnoRow[] } | { ok: false; error: string }>;
  rejectRequest: (id: string) => Promise<Result>;
}

interface Props {
  employees: CuadranteEmployee[];
  demand: Demand;
  shifts: ShiftCatalog;
  rules: Rules;
  roleLabels: Record<string, string>;
  monday: string;
  initialGrid?: Grid;
  initialStatus?: WeekStatus;
  persistence?: Persistence;
  requests?: CuadranteRequest[];
  notify?: { baseUrl: string; localName: string };
  nav?: { prev: string; next: string; today: string; isCurrent: boolean };
}

const SLOT_NAME: Record<Slot, string> = { M: "mañana", T: "tarde", N: "noche" };

const STATUS_CHIP: Record<WeekStatus, { label: string; cls: string }> = {
  borrador: { label: "Borrador", cls: "bg-[#ECEAE3] text-ink-soft" },
  publicado: { label: "Publicado", cls: "bg-ok-soft text-accent" },
  cambios: { label: "Cambios sin publicar", cls: "bg-pending-soft text-pending-ink" },
};

const GRID_COLS = "grid grid-cols-[180px_repeat(7,minmax(108px,1fr))_92px] gap-1.5";

export function Cuadrante(props: Props) {
  const { employees, demand, shifts, rules, roleLabels, monday, persistence, notify, nav } = props;
  const ids = useMemo(() => employees.map((e) => e.id), [employees]);

  const [grid, setGrid] = useState<Grid>(() => props.initialGrid ?? generateSchedule(employees, demand, shifts, rules));
  const [status, setStatus] = useState<WeekStatus>(props.initialStatus ?? "borrador");
  const [requests, setRequests] = useState<CuadranteRequest[]>(props.requests ?? []);
  const [sel, setSel] = useState<{ id: string; day: number } | null>(null);
  const [toast, setToast] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [busy, setBusy] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);

  // Cola de guardado: los guardados se hacen en orden y solo el último cuenta.
  const queue = useRef<Promise<void>>(Promise.resolve());
  const seq = useRef(0);
  const latestGrid = useRef(grid);
  const lastSaveOk = useRef(true);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // Si se cierra la pestaña con un guardado pendiente, el navegador avisa.
  useEffect(() => {
    if (saveState !== "saving") return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saveState]);

  const gaps = useMemo(() => findGaps(grid, employees, demand), [grid, employees, demand]);
  const issues = useMemo(() => findIssues(grid, employees, shifts, rules), [grid, employees, shifts, rules]);
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

  const issueText: Record<IssueKind, string> = {
    "consecutive-nights": `cierra más de ${rules.maxConsecutiveNights} noche${rules.maxConsecutiveNights > 1 ? "s" : ""} seguidas.`,
    "night-then-morning": "entra de mañana tras cerrar la noche anterior.",
    "outside-availability": "tiene un turno fuera de su disponibilidad.",
    "over-contract": "supera sus horas de contrato.",
  };

  function persist(next: Grid) {
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
  }

  function commit(next: Grid) {
    setGrid(next);
    setStatus((s) => (s === "borrador" ? "borrador" : "cambios"));
    persist(next);
  }

  function setCell(id: string, day: number, code: Code) {
    commit({ ...grid, [id]: grid[id].map((c, d) => (d === day ? code : c)) });
    setSel(null);
  }

  function regenerate() {
    if (!isEmpty && !confirm("Se sustituirá el cuadrante actual por uno nuevo. ¿Continuar?")) return;
    commit(generateSchedule(employees, demand, shifts, rules));
    setSel(null);
    setToast("Cuadrante generado según disponibilidad, necesidades y horas de contrato.");
  }

  async function publish() {
    if (status === "publicado" || busy) return;
    setBusy(true);
    setSel(null);
    try {
      if (persistence) {
        await queue.current; // primero, que termine cualquier guardado pendiente
        // Si nunca se ha guardado (semana nueva generada) o el último falló, se guarda ahora.
        if (!lastSaveOk.current || saveState === "idle") {
          const retry = await persistence.save(latestGrid.current);
          lastSaveOk.current = retry.ok;
          if (!retry.ok) return setToast("No se ha podido guardar el cuadrante. Revisa tu conexión.");
          setSaveState("saved");
        }
        const res = await persistence.publish();
        if (!res.ok) return setToast(res.error);
      }
      setStatus("publicado");
      if (notify) setNotifyOpen(true);
      else
        setToast(
          `Publicado: ${employees.length} personas recibirán su horario.` +
            (totalGaps ? ` Ojo, quedan ${totalGaps} hueco${totalGaps > 1 ? "s" : ""} sin cubrir.` : ""),
        );
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
    if (!res.ok) return setToast(res.error);
    const next = rowsToGrid(ids, res.turnos);
    setGrid(next);
    latestGrid.current = next;
    setStatus((s) => (s === "borrador" ? "borrador" : "cambios"));
    setRequests((rs) => rs.filter((x) => x.id !== r.id));
    setToast("Cambio aplicado. Recuerda publicar para que lo vea el equipo.");
  }

  async function reject(r: CuadranteRequest) {
    if (!persistence) return;
    const res = await persistence.rejectRequest(r.id);
    if (!res.ok) return setToast(res.error);
    setRequests((rs) => rs.filter((x) => x.id !== r.id));
    setToast(`Solicitud rechazada. Díselo a ${byId.get(r.empleadoId)?.name ?? "la persona"}.`);
  }

  const selEmp = sel ? byId.get(sel.id) : undefined;
  const fmt = (c: Slot) => `${shifts[c].start}–${shifts[c].end}`;

  if (employees.length === 0) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-16 text-center">
        <h1 className={ui.h1}>Primero, tu equipo</h1>
        <p className="mx-auto mt-3 max-w-md text-ink-soft">
          Para generar el cuadrante necesito saber quién trabaja contigo, sus horas de contrato y cuándo puede trabajar cada uno.
        </p>
        <Link href="/app/empleados" className={`${ui.btn} ${ui.primary} mt-6`}>
          Añadir empleados
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

  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 py-7 sm:px-8 print:max-w-none print:p-0">
      {/* Cabecera */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-1.5 flex flex-wrap items-center gap-2.5">
            <span className="text-[13px] uppercase tracking-[0.08em] text-ink-muted">Semana {isoWeekNumber(monday)}</span>
            <span className={`rounded-full px-2.5 py-1 text-[13px] font-semibold print:hidden ${STATUS_CHIP[status].cls}`}>
              {STATUS_CHIP[status].label}
            </span>
            {persistence && (
              <span className="text-[13px] text-ink-muted print:hidden" aria-live="polite">
                {saveState === "saving" && "Guardando…"}
                {saveState === "saved" && "Guardado"}
                {saveState === "error" && (
                  <button onClick={() => persist(latestGrid.current)} className="font-semibold text-danger-ink underline">
                    No se pudo guardar · Reintentar
                  </button>
                )}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            {nav && (
              <Link href={nav.prev} aria-label="Semana anterior" className="flex h-11 w-11 items-center justify-center rounded-[10px] border border-line-strong bg-surface print:hidden">
                ‹
              </Link>
            )}
            <h1 className={ui.h1}>{weekRangeLabel(monday)}</h1>
            {nav && (
              <Link href={nav.next} aria-label="Semana siguiente" className="flex h-11 w-11 items-center justify-center rounded-[10px] border border-line-strong bg-surface print:hidden">
                ›
              </Link>
            )}
            {nav && !nav.isCurrent && (
              <Link href={nav.today} className="ml-1 text-sm font-semibold text-accent underline print:hidden">
                Ir a esta semana
              </Link>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2.5 print:hidden">
          <button onClick={() => window.print()} className={`${ui.btn} ${ui.secondary}`}>
            Imprimir
          </button>
          <button onClick={regenerate} disabled={busy} className={`${ui.btn} ${ui.secondary}`}>
            Generar automáticamente
          </button>
          <button onClick={publish} disabled={busy || status === "publicado"} className={`${ui.btn} ${ui.primary}`}>
            {busy ? "Un momento…" : status === "publicado" ? "Publicado ✓" : status === "cambios" ? "Publicar cambios" : "Publicar y avisar al equipo"}
          </button>
        </div>
      </div>

      {toast && (
        <div role="status" className="mb-5 rounded-xl bg-ink px-[18px] py-3.5 text-[15px] text-white print:hidden">
          {toast}
        </div>
      )}
      {isEmpty && (
        <div className={`${ui.success} mb-5 text-[15px] print:hidden`}>
          Esta semana está vacía. Pulsa <strong>Generar automáticamente</strong> y retoca lo que necesites.
        </div>
      )}

      <div className="flex flex-wrap items-start gap-6">
        {/* Cuadrícula */}
        <section aria-label="Cuadrante" className={`${ui.card} min-w-0 flex-[999_1_760px] p-[18px] print:border-0 print:p-0`}>
          <p className="mb-3 text-right text-[13px] text-ink-muted print:hidden">Toca una casilla para cambiar el turno</p>
          <div className="overflow-x-auto">
            <div className="flex min-w-[1040px] flex-col gap-1.5 p-1">
              <div className={`${GRID_COLS} pb-1 text-[13px] font-semibold text-ink-muted`}>
                <div>Empleado</div>
                {DAY_SHORT.map((d, i) => (
                  <div key={d}>
                    {d} {dayOfMonth(monday, i)}
                  </div>
                ))}
                <div className="text-right">Horas</div>
              </div>

              {employees.map((e) => {
                const diff = hours[e.id] - e.contractHours;
                return (
                  <div key={e.id} className={GRID_COLS}>
                    <div className="flex flex-col justify-center pr-2">
                      <div className="text-[15px] font-semibold">{e.name}</div>
                      <div className="text-xs text-ink-muted">{roleLabels[e.role] ?? e.role}</div>
                    </div>
                    {grid[e.id].map((c, d) => {
                      const isSel = sel?.id === e.id && sel.day === d;
                      const bad = badCells.has(`${e.id}:${d}`);
                      const look =
                        c === "L" ? "border border-dashed border-[#CFCBC0] bg-surface text-[#8A877F]" : (ROLE_STYLES[e.role] ?? "bg-line");
                      return (
                        <button
                          key={d}
                          onClick={() => setSel({ id: e.id, day: d })}
                          aria-label={`${e.name}, ${DAY_LONG[d]}: ${c === "L" ? "libre" : shifts[c].label}`}
                          className={`flex min-h-14 w-full flex-col justify-center gap-0.5 rounded-[10px] px-2.5 py-2 text-left text-[13px] leading-tight transition hover:-translate-y-px hover:shadow ${look} ${bad ? "border-2 border-danger" : ""} ${isSel ? "outline-[3px] outline-offset-2 outline-ink" : ""}`}
                        >
                          <strong className="text-sm font-semibold">{c === "L" ? "Libre" : fmt(c)}</strong>
                          <span>{c === "L" ? "" : shifts[c].label}</span>
                        </button>
                      );
                    })}
                    <div className="flex flex-col items-end justify-center text-sm">
                      <span className={diff === 0 ? "font-semibold text-accent" : diff > 0 ? "font-semibold text-danger" : "text-ink-soft"}>
                        {hours[e.id]} / {e.contractHours} h
                      </span>
                      <span className="text-xs text-ink-muted">{diff === 0 ? "Cuadra" : diff > 0 ? `+${diff} h` : `−${-diff} h`}</span>
                    </div>
                  </div>
                );
              })}

              <div className={`${GRID_COLS} mt-1 border-t border-[#EEEBE3] pt-1.5 print:hidden`}>
                <div className="flex items-center text-[13px] font-semibold text-ink-soft">Cobertura del día</div>
                {DAY_SHORT.map((_, d) => {
                  const miss = gaps.filter((g) => g.day === d).reduce((a, g) => a + g.missing, 0);
                  return (
                    <div
                      key={d}
                      className={`rounded-lg px-2 py-1.5 text-center text-xs font-semibold ${miss ? "bg-danger-soft text-danger-ink" : "bg-ok-soft text-accent"}`}
                    >
                      {miss ? `Falta${miss > 1 ? `n ${miss}` : " 1"}` : "Completo"}
                    </div>
                  );
                })}
                <div />
              </div>
            </div>
          </div>
        </section>

        {/* Panel lateral */}
        <aside className="flex flex-[1_1_300px] flex-col gap-4 print:hidden">
          <div className={`${ui.card} p-5`}>
            {sel && selEmp ? (
              <>
                <div className="mb-3.5 flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[13px] text-ink-muted">Cambiar turno</div>
                    <h2 className={ui.h2}>
                      {selEmp.name} · {DAY_LONG[sel.day]} {dayOfMonth(monday, sel.day)}
                    </h2>
                  </div>
                  <button aria-label="Cerrar" onClick={() => setSel(null)} className="flex h-11 w-11 items-center justify-center rounded-[10px] border border-line-strong">
                    ✕
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(["M", "T", "N", "L"] as Code[]).map((code) => {
                    const available = code === "L" || selEmp.availability[code][sel.day];
                    const current = grid[sel.id][sel.day] === code;
                    return (
                      <button
                        key={code}
                        onClick={() => setCell(sel.id, sel.day, code)}
                        className={`flex min-h-14 flex-col gap-0.5 rounded-[10px] px-3 py-2.5 text-left ${current ? "border-2 border-ink bg-ground" : "border border-line-strong bg-surface hover:border-ink"}`}
                      >
                        <span className="text-[15px] font-semibold">{code === "L" ? "Libre" : shifts[code].label}</span>
                        <small className={`text-xs ${available ? "text-ink-muted" : "text-danger-ink"}`}>
                          {code === "L" ? "Día libre" : fmt(code) + (available ? "" : " · no disponible")}
                        </small>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <h2 className={`${ui.h2} mb-1.5`}>Cómo funciona</h2>
                <ol className="list-decimal pl-5 text-sm leading-relaxed text-ink-soft">
                  <li>
                    Pulsa <strong>Generar automáticamente</strong>.
                  </li>
                  <li>Toca cualquier casilla para retocarla.</li>
                  <li>Resuelve los avisos en rojo.</li>
                  <li>
                    <strong>Publica</strong> y avisa a cada uno por WhatsApp.
                  </li>
                </ol>
              </>
            )}
          </div>

          <div className={`${ui.card} p-5`}>
            <h2 className={`${ui.h2} mb-3.5`}>
              {warningCount === 0 ? "Sin avisos" : warningCount === 1 ? "1 cosa por revisar" : `${warningCount} cosas por revisar`}
            </h2>
            {warningCount === 0 ? (
              <p className="text-sm text-accent">Todo cubierto y sin conflictos. Listo para publicar.</p>
            ) : (
              <ul className="flex flex-col gap-3 text-sm leading-snug">
                {gaps.map((g) => (
                  <li key={`g-${g.day}-${g.slot}-${g.role}`}>
                    <strong>
                      {DAY_SHORT[g.day]} {dayOfMonth(monday, g.day)} · {SLOT_NAME[g.slot]}:
                    </strong>{" "}
                    falta{g.missing > 1 ? `n ${g.missing}` : " 1"} en {(roleLabels[g.role] ?? g.role).toLowerCase()}.
                  </li>
                ))}
                {issues.map((i) => (
                  <li key={`i-${i.employeeId}-${i.kind}`}>
                    <strong>{byId.get(i.employeeId)?.name}</strong> {issueText[i.kind]}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {persistence && (
            <div className={`${ui.card} p-5`}>
              <h2 className={`${ui.h2} mb-3.5`}>Solicitudes de cambio</h2>
              {requests.length === 0 ? (
                <p className="text-sm text-ink-muted">No hay solicitudes pendientes.</p>
              ) : (
                <div className="flex flex-col gap-4">
                  {requests.map((r) => {
                    const who = byId.get(r.empleadoId)?.name ?? "Alguien";
                    const day = `el ${DAY_LONG[r.dia]} ${dayOfMonth(monday, r.dia)}`;
                    const what =
                      r.tipo === "librar" ? `pide librar ${day}.` : `quiere cambiarse ${day} con ${byId.get(r.conEmpleadoId ?? "")?.name ?? "un compañero"}.`;
                    return (
                      <div key={r.id} className="border-t border-[#EEEBE3] pt-3.5 text-sm leading-snug first:border-0 first:pt-0">
                        <div>
                          <strong>{who}</strong> {what}
                        </div>
                        {r.mensaje && <p className="mt-1 text-ink-soft">“{r.mensaje}”</p>}
                        <div className="mt-2 flex gap-2">
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
    </main>
  );
}
