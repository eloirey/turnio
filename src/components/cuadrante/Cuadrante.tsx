"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_RULES,
  DEFAULT_SHIFTS,
  findGaps,
  findIssues,
  generateSchedule,
  hoursByEmployee,
  type Code,
  type Demand,
  type Employee,
  type Grid,
  type IssueKind,
  type Slot,
} from "@/lib/schedule";

const DAY_SHORT = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const DAY_LONG = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
const SLOT_NAME: Record<Slot, string> = { M: "mañana", T: "tarde", N: "noche" };

// Clases completas (Tailwind solo incluye clases que aparecen escritas literalmente).
const ROLE_STYLES: Record<string, string> = {
  sala: "bg-sala text-sala-ink",
  cocina: "bg-cocina text-cocina-ink",
  barra: "bg-barra text-barra-ink",
};

const ISSUE_TEXT: Record<IssueKind, string> = {
  "consecutive-nights": `cierra más de ${DEFAULT_RULES.maxConsecutiveNights} noches seguidas.`,
  "night-then-morning": "entra de mañana tras cerrar la noche anterior.",
  "outside-availability": "tiene un turno fuera de su disponibilidad.",
  "over-contract": "supera sus horas de contrato.",
};

type Status = "borrador" | "publicado" | "cambios";

const STATUS_CHIP: Record<Status, { label: string; cls: string }> = {
  borrador: { label: "Borrador", cls: "bg-[#ECEAE3] text-ink-soft" },
  publicado: { label: "Publicado", cls: "bg-ok-soft text-accent" },
  cambios: { label: "Cambios sin publicar", cls: "bg-pending-soft text-pending-ink" },
};

function fmtShift(code: Slot) {
  const s = DEFAULT_SHIFTS[code];
  return `${s.start.replace(/^0/, "")}–${s.end}`;
}

interface Props {
  employees: Employee[];
  demand: Demand;
  roleLabels: Record<string, string>;
  weekLabel: string;
}

export function Cuadrante({ employees, demand, roleLabels, weekLabel }: Props) {
  const [grid, setGrid] = useState<Grid>(() => generateSchedule(employees, demand));
  const [sel, setSel] = useState<{ id: string; day: number } | null>(null);
  const [status, setStatus] = useState<Status>("borrador");
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // Todo lo derivado se recalcula a partir del cuadrante: nunca se guarda duplicado.
  const gaps = useMemo(() => findGaps(grid, employees, demand), [grid, employees, demand]);
  const issues = useMemo(() => findIssues(grid, employees), [grid, employees]);
  const hours = useMemo(() => hoursByEmployee(grid, employees), [grid, employees]);

  const badCells = useMemo(() => {
    const set = new Set<string>();
    for (const i of issues) for (const d of i.days) set.add(`${i.employeeId}:${d}`);
    return set;
  }, [issues]);

  const byId = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);
  const totalGaps = gaps.reduce((a, g) => a + g.missing, 0);
  const warningCount = gaps.length + issues.length;

  function markEdited(next: Grid) {
    setGrid(next);
    setStatus((s) => (s === "borrador" ? "borrador" : "cambios"));
  }

  function setCell(id: string, day: number, code: Code) {
    markEdited({ ...grid, [id]: grid[id].map((c, d) => (d === day ? code : c)) });
    setSel(null);
  }

  function regenerate() {
    markEdited(generateSchedule(employees, demand));
    setSel(null);
    setToast("Cuadrante generado según disponibilidad y horas de contrato.");
  }

  function publish() {
    if (status === "publicado") return;
    setStatus("publicado");
    setSel(null);
    setToast(
      `Publicado: ${employees.length} personas recibirán su horario.` +
        (totalGaps ? ` Ojo, quedan ${totalGaps} hueco${totalGaps > 1 ? "s" : ""} sin cubrir.` : ""),
    );
  }

  const selEmp = sel ? byId.get(sel.id) : undefined;

  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 py-7 sm:px-8">
      {/* Cabecera de la semana */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-1.5 flex items-center gap-2.5">
            <span className="text-[13px] uppercase tracking-[0.08em] text-ink-muted">{weekLabel}</span>
            <span className={`rounded-full px-2.5 py-1 text-[13px] font-semibold ${STATUS_CHIP[status].cls}`}>
              {STATUS_CHIP[status].label}
            </span>
          </div>
          <h1 className="font-display text-[34px] font-bold tracking-tight">12 – 18 octubre</h1>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={regenerate}
            className="flex h-[46px] items-center gap-2 rounded-[10px] border border-line-strong bg-surface px-[18px] text-[15px] font-semibold"
          >
            Generar automáticamente
          </button>
          <button
            onClick={publish}
            className="flex h-[46px] items-center gap-2 rounded-[10px] bg-accent px-5 text-[15px] font-semibold text-white"
          >
            {status === "publicado" ? "Publicado" : status === "cambios" ? "Publicar cambios" : "Publicar y avisar al equipo"}
          </button>
        </div>
      </div>

      {toast && (
        <div role="status" className="mb-5 rounded-xl bg-ink px-[18px] py-3.5 text-[15px] text-white">
          {toast}
        </div>
      )}

      <div className="flex flex-wrap items-start gap-6">
        {/* Cuadrícula */}
        <section aria-label="Cuadrante" className="min-w-0 flex-[999_1_760px] rounded-2xl border border-line bg-surface p-[18px]">
          <p className="mb-3.5 text-right text-[13px] text-ink-muted">Toca una casilla para cambiar el turno</p>
          <div className="overflow-x-auto">
            <div className="flex min-w-[1080px] flex-col gap-1.5 p-1">
              <div className="grid grid-cols-[190px_repeat(7,minmax(112px,1fr))_96px] gap-1.5 pb-1 text-[13px] font-semibold text-ink-muted">
                <div>Empleado</div>
                {DAY_SHORT.map((d, i) => (
                  <div key={d}>{d} {12 + i}</div>
                ))}
                <div className="text-right">Horas</div>
              </div>

              {employees.map((e) => {
                const diff = hours[e.id] - e.contractHours;
                return (
                  <div key={e.id} className="grid grid-cols-[190px_repeat(7,minmax(112px,1fr))_96px] gap-1.5">
                    <div className="flex flex-col justify-center pr-2">
                      <div className="text-[15px] font-semibold">{e.name}</div>
                      <div className="text-xs text-ink-muted">{roleLabels[e.role] ?? e.role}</div>
                    </div>

                    {grid[e.id].map((c, d) => {
                      const isSel = sel?.id === e.id && sel.day === d;
                      const bad = badCells.has(`${e.id}:${d}`);
                      const base =
                        "flex min-h-14 w-full cursor-pointer flex-col justify-center gap-0.5 rounded-[10px] px-2.5 py-2 text-left text-[13px] leading-tight transition hover:-translate-y-px hover:shadow";
                      const look = c === "L" ? "border border-dashed border-[#CFCBC0] bg-surface text-[#8A877F]" : ROLE_STYLES[e.role] ?? "bg-line";
                      return (
                        <button
                          key={d}
                          onClick={() => setSel({ id: e.id, day: d })}
                          aria-label={`${e.name}, ${DAY_LONG[d]}: ${c === "L" ? "libre" : DEFAULT_SHIFTS[c].label}`}
                          className={`${base} ${look} ${bad ? "border-2 border-danger" : ""} ${isSel ? "outline-[3px] outline-offset-2 outline-ink" : ""}`}
                        >
                          <strong className="text-sm font-semibold">{c === "L" ? "Libre" : fmtShift(c)}</strong>
                          <span>{c === "L" ? "" : DEFAULT_SHIFTS[c].label}</span>
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

              {/* Cobertura */}
              <div className="mt-1 grid grid-cols-[190px_repeat(7,minmax(112px,1fr))_96px] gap-1.5 border-t border-[#EEEBE3] pt-1.5">
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
        <aside className="flex flex-[1_1_300px] flex-col gap-4">
          <div className="rounded-2xl border border-line bg-surface p-5">
            {sel && selEmp ? (
              <>
                <div className="mb-3.5 flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[13px] text-ink-muted">Cambiar turno</div>
                    <h2 className="font-display text-xl font-bold">
                      {selEmp.name} · {DAY_LONG[sel.day]} {12 + sel.day}
                    </h2>
                  </div>
                  <button
                    aria-label="Cerrar"
                    onClick={() => setSel(null)}
                    className="flex h-11 w-11 items-center justify-center rounded-[10px] border border-line-strong"
                  >
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
                        <span className="text-[15px] font-semibold">{code === "L" ? "Libre" : DEFAULT_SHIFTS[code].label}</span>
                        <small className={`text-xs ${available ? "text-ink-muted" : "text-danger-ink"}`}>
                          {code === "L" ? "Día libre" : fmtShift(code) + (available ? "" : " · no disponible")}
                        </small>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <h2 className="mb-1.5 font-display text-xl font-bold">Cómo funciona</h2>
                <ol className="list-decimal pl-5 text-sm leading-relaxed text-ink-soft">
                  <li>Pulsa <strong>Generar automáticamente</strong>.</li>
                  <li>Toca cualquier casilla para retocarla.</li>
                  <li>Resuelve los avisos en rojo.</li>
                  <li><strong>Publica</strong>: cada empleado recibe su horario.</li>
                </ol>
              </>
            )}
          </div>

          <div className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="mb-3.5 font-display text-xl font-bold">
              {warningCount === 0 ? "Sin avisos" : warningCount === 1 ? "1 cosa por revisar" : `${warningCount} cosas por revisar`}
            </h2>
            {warningCount === 0 ? (
              <p className="text-sm text-accent">Todo cubierto y sin conflictos. Listo para publicar.</p>
            ) : (
              <ul className="flex flex-col gap-3 text-sm leading-snug">
                {gaps.map((g) => (
                  <li key={`g-${g.day}-${g.slot}-${g.role}`}>
                    <strong>{DAY_SHORT[g.day]} {12 + g.day} · {SLOT_NAME[g.slot]}:</strong> falta
                    {g.missing > 1 ? `n ${g.missing}` : " 1"} en {(roleLabels[g.role] ?? g.role).toLowerCase()}.
                  </li>
                ))}
                {issues.map((i) => (
                  <li key={`i-${i.employeeId}-${i.kind}`}>
                    <strong>{byId.get(i.employeeId)?.name}</strong> {ISSUE_TEXT[i.kind]}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
