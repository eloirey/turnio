"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useToast } from "@/components/feedback";
import { NavLink, useIsDemo } from "@/components/nav";
import { WeekPicker } from "@/components/WeekPicker";
import { shiftTimes } from "@/lib/schedule/rules";
import { ui } from "@/components/ui";
import { addDays, DAY_LONG, DAY_SHORT, dayOfMonth, weekRangeLabel } from "@/lib/dates";
import { dayStatus, groupByEmployeeDay, hoursClock, madridDate, madridTime, needsAttention, STATUS_LABEL, type ClockChange, type ClockRecord, type DayStatus, type DayStatusKind, placeFlag } from "@/lib/fichajes";
import { roleMap, roleStyle, type Role } from "@/lib/roles";
import type { ShiftCatalog, ShiftDef } from "@/lib/schedule/types";
import * as serverActions from "./actions";
import { DayEditor } from "./DayEditor";
import { ExportMenu } from "./ExportMenu";

export interface ClockActions {
  saveClock: typeof serverActions.saveClock;
  deleteClock: typeof serverActions.deleteClock;
  exportClock?: typeof serverActions.exportClock;
}

export interface BoardPerson {
  id: string;
  name: string;
  role: string;
  archived?: boolean;
}

interface Props {
  people: BoardPerson[];
  roles: Role[];
  shifts: ShiftCatalog;
  records: ClockRecord[];
  planned: { employeeId: string; date: string; slot: string }[];
  changes: ClockChange[];
  monday: string;
  today: string;
  now: string;
  marginMinutes: number;
  /** Desde qué día se ficha (antes no se marca «No fichó»). */
  clockSince?: string | null;
  nav?: { prev: string; next: string; today: string; isCurrent: boolean };
  actions?: ClockActions;
  /** Tras guardar: la app recarga los datos del servidor; la demo ya los tiene. */
  onChanged?: () => void;
}

export interface Cell extends DayStatus {
  date: string;
  records: ClockRecord[];
  shift: ShiftDef | null;
  future: boolean;
}

/** Etiquetas cortas para que quepan en la casilla. */
const SHORT: Partial<Record<DayStatusKind, string>> = {
  ok: "Correcto",
  open: "Trabajando",
  forgot: "Sin salida",
  missing: "No fichó",
  unplanned: "Sin turno",
};

// Tres colores bien distintos: verde (bien), naranja (tarde o antes), rojo (revisar).
const OK_CHIP = "bg-[#CDEBD9] text-[#0F5132]";
const LATE_CHIP = "bg-[#FFD9A8] text-[#7A3E00]";
const BAD_CHIP = "bg-[#F8C9B8] text-[#8A2A0A]";

const CHIP: Partial<Record<DayStatusKind, string>> = {
  ok: OK_CHIP,
  late: LATE_CHIP,
  early: LATE_CHIP,
  open: "bg-accent text-white",
  forgot: BAD_CHIP,
  missing: BAD_CHIP,
  unplanned: "bg-[#ECEAE3] text-ink-soft",
};

/** Fondo de la casilla según cómo fue el día. */
const CELL: Partial<Record<DayStatusKind, string>> = {
  ok: "border-[#A9D6BC] bg-[#F2FAF5]",
  late: "border-[#F3C58C] bg-[#FFF5E8]",
  early: "border-[#F3C58C] bg-[#FFF5E8]",
  forgot: "border-[#EBA48B] bg-[#FDEEE8]",
  missing: "border-[#EBA48B] bg-[#FDEEE8]",
};

export function FichajesBoard(props: Props) {
  const { people, roles, shifts, records, planned, changes, monday, today, marginMinutes, clockSince, nav, actions = serverActions } = props;
  const router = useRouter();
  const isDemo = useIsDemo();
  const onChanged = props.onChanged ?? (() => router.refresh());
  const toast = useToast();
  const [editing, setEditing] = useState<{ personId: string; date: string } | null>(null);
  const now = useMemo(() => new Date(props.now), [props.now]);
  const roleById = roleMap(roles);

  const byDay = useMemo(() => groupByEmployeeDay(records), [records]);
  const days = Array.from({ length: 7 }, (_, d) => addDays(monday, d));

  const cell = (personId: string, date: string): Cell => {
    const recs = byDay.get(`${personId}|${date}`) ?? [];
    const slot = planned.find((p) => p.employeeId === personId && p.date === date)?.slot;
    const shift = slot && shifts[slot] ? shifts[slot] : null;
    const future = date > today;
    const st = future ? { kind: (shift ? "pending" : "none") as DayStatusKind, worked: 0, planned: shift?.hours ?? 0, lateMinutes: 0, earlyMinutes: 0 } : dayStatus(date, recs, shift, now, marginMinutes, clockSince);
    return { ...st, date, records: recs, shift, future };
  };

  const grid = people.map((p) => ({ person: p, cells: days.map((date) => cell(p.id, date)) }));
  const working = grid.flatMap((g) => g.cells.filter((c) => c.kind === "open").map((c) => ({ person: g.person, since: c.records.find((r) => !r.end)?.start ?? "" })));
  const attention = grid.flatMap((g) => g.cells.filter((c) => needsAttention(c.kind)).map((c) => ({ person: g.person, cell: c })));
  const worked = grid.reduce((a, g) => a + g.cells.reduce((x, c) => x + c.worked, 0), 0);
  const plannedHours = grid.reduce((a, g) => a + g.cells.reduce((x, c) => x + (c.future ? 0 : c.planned), 0), 0);
  const includesToday = days.includes(today);

  return (
    <main className="anim-page mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-8 sm:py-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-1.5 text-[13px] font-medium uppercase tracking-[0.08em] text-ink-muted">Registro de jornada</div>
          <div className="flex items-center gap-2">
            {nav && (
              <NavLink href={nav.prev} className="flex h-10 w-10 flex-none items-center justify-center rounded-[10px] border border-line-strong bg-surface text-lg hover:border-ink">
                <span aria-hidden>‹</span>
                <span className="sr-only">Semana anterior</span>
              </NavLink>
            )}
            {nav ? <WeekPicker monday={monday} base={nav.today} /> : <h1 className="font-display text-[28px] font-bold leading-tight tracking-tight sm:text-[34px]">{weekRangeLabel(monday)}</h1>}
            {nav && (
              <NavLink href={nav.next} className="flex h-10 w-10 flex-none items-center justify-center rounded-[10px] border border-line-strong bg-surface text-lg hover:border-ink">
                <span aria-hidden>›</span>
                <span className="sr-only">Semana siguiente</span>
              </NavLink>
            )}
            {nav && !nav.isCurrent && (
              <NavLink href={nav.today} className="ml-1 text-sm font-semibold text-accent underline-offset-2 hover:underline">
                Hoy
              </NavLink>
            )}
          </div>
        </div>
        {actions.exportClock && <ExportMenu monday={monday} today={today} exportClock={actions.exportClock} onError={(m) => toast.show({ message: m, tone: "error" })} />}
      </div>

      {/* ---------- Resumen ---------- */}
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className={`${ui.card} p-4`}>
          <div className="text-[13px] font-medium text-ink-muted">Trabajando ahora</div>
          {includesToday && working.length > 0 ? (
            <>
              <div className="mt-1 font-display text-3xl font-bold text-accent">{working.length}</div>
              <div className="mt-1 truncate text-sm text-ink-soft">{working.map((w) => `${w.person.name} (desde ${madridTime(w.since)})`).join(", ")}</div>
            </>
          ) : (
            <>
              <div className="mt-1 font-display text-3xl font-bold text-ink-muted">0</div>
              <div className="mt-1 text-sm text-ink-muted">{includesToday ? "Nadie ha fichado la entrada ahora mismo." : "Solo se ve en la semana actual."}</div>
            </>
          )}
        </div>
        <div className={`${ui.card} p-4`}>
          <div className="text-[13px] font-medium text-ink-muted">Por revisar</div>
          <div className={`mt-1 font-display text-3xl font-bold ${attention.length ? "text-danger-ink" : "text-accent"}`}>{attention.length}</div>
          <div className="mt-1 text-sm text-ink-muted">{attention.length ? "Olvidos y turnos sin fichar." : "Todo correcto esta semana."}</div>
        </div>
        <div className={`${ui.card} p-4`}>
          <div className="text-[13px] font-medium text-ink-muted">Horas fichadas</div>
          <div className="mt-1 font-display text-3xl font-bold tabular-nums">{hoursClock(worked)}</div>
          <div className="mt-1 text-sm text-ink-muted">de {hoursClock(plannedHours)} previstas hasta hoy</div>
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-6">
        {/* ---------- Tabla ---------- */}
        <section aria-label="Fichajes de la semana" className={`${ui.card} min-w-0 flex-[999_1_720px] p-3 sm:p-4`}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1 text-[13px] text-ink-muted">
            <span>Toca un día para ver los tramos o corregirlos.</span>
            <span className="flex flex-wrap gap-3">
              <Legend cls={OK_CHIP} label="Correcto" />
              <Legend cls={LATE_CHIP} label={`Tarde o antes (más de ${marginMinutes} min)`} />
              <Legend cls={BAD_CHIP} label="Por revisar" />
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] table-fixed border-separate border-spacing-1.5 text-sm">
              <colgroup>
                <col className="w-[150px]" />
                {days.map((d) => (
                  <col key={d} />
                ))}
                <col className="w-[84px]" />
              </colgroup>
              <thead>
                <tr className="text-left text-[13px] text-ink-muted">
                  <th className="sticky left-0 z-10 bg-surface font-semibold">Persona</th>
                  {days.map((date, d) => (
                    <th key={date} className={`font-semibold ${date === today ? "text-accent" : ""}`}>
                      {DAY_SHORT[d]} <span className="font-normal">{dayOfMonth(monday, d)}</span>
                    </th>
                  ))}
                  <th className="text-right font-semibold">Semana</th>
                </tr>
              </thead>
              <tbody>
                {grid.map(({ person, cells }) => {
                  const total = cells.reduce((a, c) => a + c.worked, 0);
                  const plan = cells.reduce((a, c) => a + c.planned, 0);
                  return (
                    <tr key={person.id}>
                      <th scope="row" className="sticky left-0 z-10 bg-surface pr-2 text-left font-normal">
                        <div className="flex items-center gap-2">
                          <span className="h-7 w-1.5 flex-none rounded-full" style={{ backgroundColor: roleStyle(roleById[person.role]?.color).backgroundColor }} />
                          <span className="min-w-0">
                            <span className="block truncate text-[15px] font-semibold">{person.name}</span>
                            <span className="block truncate text-xs text-ink-muted">{person.archived ? "Ya no está en el equipo" : (roleById[person.role]?.name ?? person.role)}</span>
                          </span>
                        </div>
                      </th>
                      {cells.map((c) => (
                        <td key={c.date} className="align-top">
                          <DayCell c={c} disabled={c.future} onOpen={() => setEditing({ personId: person.id, date: c.date })} />
                        </td>
                      ))}
                      <td className="text-right align-middle">
                        <div className="font-semibold tabular-nums">{hoursClock(total)}</div>
                        <div className="text-xs text-ink-muted tabular-nums">de {hoursClock(plan)}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* ---------- Incidencias ---------- */}
        <aside className={`${ui.card} w-full p-5 lg:w-auto lg:flex-[1_1_300px]`}>
          <h2 className={`${ui.h2} mb-3`}>{attention.length ? `${attention.length} por revisar` : "Nada por revisar"}</h2>
          {attention.length === 0 ? (
            <p className="text-sm leading-relaxed text-ink-soft">Cuando alguien olvide fichar la salida o tenga turno y no fiche, aparecerá aquí para que lo corrijas.</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {attention.map(({ person, cell: c }) => (
                <li key={`${person.id}-${c.date}`}>
                  <button onClick={() => setEditing({ personId: person.id, date: c.date })} className="flex w-full gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-ground">
                    <span className="mt-[7px] h-2 w-2 flex-none rounded-full bg-danger" aria-hidden />
                    <span>
                      <strong>{person.name}</strong> · {DAY_LONG[(Date.parse(c.date) - Date.parse(monday)) / 86_400_000]} {c.date.slice(8)}: {STATUS_LABEL[c.kind].toLowerCase()}.
                      <span className="ml-1 font-semibold text-accent">Corregir →</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 border-t border-[#EEEBE3] pt-4 text-[13px] leading-relaxed text-ink-muted">Cada corrección queda guardada con su motivo y la hora original.</p>
          <div className="mt-3 rounded-xl bg-accent-soft p-4 text-[13px] leading-relaxed text-accent-ink">
            <strong className="mb-1 block text-sm">Guarda tu copia cada mes</strong>
            La ley pide conservar el registro de jornada 4 años y enseñarlo si lo piden la persona, sus representantes o la Inspección. Rotafy lo mantiene
            mientras uses tu cuenta, pero no es un archivo: la copia que cuenta es la tuya. A principio de mes, pulsa «Exportar registro…» y guárdala (o mándala a
            tu gestoría).{" "}
            <a href="/legal/aviso-legal" target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-2">
              Condiciones
            </a>
          </div>
        </aside>
      </div>

      {editing && (
        <DayEditor
          key={`${editing.personId}|${editing.date}`}
          person={people.find((p) => p.id === editing.personId)!}
          cell={cell(editing.personId, editing.date)}
          monday={monday}
          changes={changes.filter(
            (ch) =>
              ch.employeeId === editing.personId &&
              madridDate((ch.after ?? ch.before)?.entrada ?? "1970-01-01T00:00:00Z") === editing.date,
          )}
          actions={actions}
          isDemo={isDemo}
          onClose={() => setEditing(null)}
          onSaved={(m) => {
            setEditing(null);
            toast.show(m);
            onChanged();
          }}
        />
      )}
      {toast.view}
    </main>
  );
}

function Legend({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-3.5 w-3.5 rounded-[4px] ${cls}`} />
      {label}
    </span>
  );
}

function DayCell({ c, disabled, onOpen }: { c: Cell; disabled: boolean; onOpen: () => void }) {
  const first = c.records[0];
  const last = c.records[c.records.length - 1];
  const range = first ? `${madridTime(first.start)}–${last?.end ? madridTime(last.end) : last?.missingEnd ? "?" : "…"}` : "";
  const planned = c.shift ? `${c.shift.label} ${shiftTimes(c.shift)}` : "";
  if (c.kind === "none" && !c.shift) return <div className="flex h-[68px] items-center justify-center rounded-[10px] text-ink-muted/50">—</div>;
  // Futuro, pendiente o de antes de activar el fichaje: solo el turno previsto.
  const dashed = c.future || c.kind === "pending" || c.kind === "none";
  return (
    <button
      onClick={onOpen}
      disabled={disabled}
      title={planned ? `Previsto: ${planned}` : "Sin turno previsto"}
      className={`flex h-[68px] w-full flex-col justify-center gap-0.5 rounded-[10px] border px-2.5 text-left transition enabled:hover:-translate-y-px enabled:hover:shadow-md ${
        dashed ? "border-dashed border-line-strong text-ink-muted" : (CELL[c.kind] ?? "border-line bg-surface")
      }`}
    >
      {dashed ? (
        <>
          <span className="truncate text-[13px] font-semibold">{c.shift?.label}</span>
          <span className="truncate text-xs tabular-nums">{c.shift ? shiftTimes(c.shift) : ""}</span>
        </>
      ) : (
        <>
          <span className="flex items-baseline justify-between gap-1">
            <strong className="text-[15px] font-semibold tabular-nums">{c.records.length ? hoursClock(c.worked) : "0:00"}</strong>
            {c.records.some((r) => r.edited) && (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted" title="Corregido por el encargado">
                Editado
              </span>
            )}
          </span>
          <span className="truncate text-xs text-ink-soft tabular-nums">{range || planned}</span>
          <span className="flex min-w-0 items-center gap-1">
            {CHIP[c.kind] && (
              <span className={`w-fit max-w-full truncate rounded px-1.5 text-[11px] font-semibold ${CHIP[c.kind]}`}>
                {c.kind === "late" ? `Tarde +${c.lateMinutes}′` : c.kind === "early" ? `Antes −${c.earlyMinutes}′` : (SHORT[c.kind] ?? STATUS_LABEL[c.kind])}
              </span>
            )}
            {placeFlag(c.records) === "fuera" && (
              <span title="Fichó fuera del local" className="flex-none rounded bg-[#F8C9B8] px-1 text-[11px] font-semibold text-[#8A2A0A]">
                {CHIP[c.kind] ? "📍" : "📍 Fuera"}
              </span>
            )}
            {c.records.some((r) => r.placeIn === "teletrabajo") && (
              <span title="Teletrabajo" className="flex-none text-[12px]">
                🏠
              </span>
            )}
          </span>
        </>
      )}
    </button>
  );
}

