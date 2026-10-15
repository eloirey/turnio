"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { useToast } from "@/components/feedback";
import { NavLink, useIsDemo } from "@/components/nav";
import { WeekPicker } from "@/components/WeekPicker";
import { shiftTimes } from "@/lib/schedule/rules";
import { ExportChooser } from "@/components/ExportChooser";
import { CLOCK_MODELS, clockTable, monthOption } from "@/lib/export-clock";
import { saveBlob, tableCsv, tablesToXlsx } from "@/lib/export-table";
import { ui } from "@/components/ui";
import { addDays, DAY_LONG, DAY_SHORT, dayOfMonth, weekRangeLabel } from "@/lib/dates";
import {
  dayStatus,
  groupByEmployeeDay,
  hoursClock,
  madridDate,
  madridTime,
  needsAttention,
  STATUS_LABEL,
  type ClockChange,
  type ClockRecord,
  type DayStatus,
  type DayStatusKind,
  placeFlag,
  placeText,
} from "@/lib/fichajes";
import { roleMap, roleStyle, type Role } from "@/lib/roles";
import type { ShiftCatalog, ShiftDef } from "@/lib/schedule/types";
import * as serverActions from "./actions";

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
  nav?: { prev: string; next: string; today: string; isCurrent: boolean };
  actions?: ClockActions;
  /** Tras guardar: la app recarga los datos del servidor; la demo ya los tiene. */
  onChanged?: () => void;
}

interface Cell extends DayStatus {
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
  const { people, roles, shifts, records, planned, changes, monday, today, marginMinutes, nav, actions = serverActions } = props;
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
    const st = future ? { kind: (shift ? "pending" : "none") as DayStatusKind, worked: 0, planned: shift?.hours ?? 0, lateMinutes: 0, earlyMinutes: 0 } : dayStatus(date, recs, shift, now, marginMinutes);
    return { ...st, date, records: recs, shift, future };
  };

  const grid = people.map((p) => ({ person: p, cells: days.map((date) => cell(p.id, date)) }));
  const working = grid.flatMap((g) => g.cells.filter((c) => c.kind === "open").map((c) => ({ person: g.person, since: c.records.find((r) => !r.end)?.start ?? "" })));
  const attention = grid.flatMap((g) => g.cells.filter((c) => needsAttention(c.kind)).map((c) => ({ person: g.person, cell: c })));
  const worked = grid.reduce((a, g) => a + g.cells.reduce((x, c) => x + c.worked, 0), 0);
  const plannedHours = grid.reduce((a, g) => a + g.cells.reduce((x, c) => x + (c.future ? 0 : c.planned), 0), 0);
  const includesToday = days.includes(today);

  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-8 sm:py-8">
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
  if (c.kind === "none") return <div className="flex h-[68px] items-center justify-center rounded-[10px] text-ink-muted/50">—</div>;
  return (
    <button
      onClick={onOpen}
      disabled={disabled}
      title={planned ? `Previsto: ${planned}` : "Sin turno previsto"}
      className={`flex h-[68px] w-full flex-col justify-center gap-0.5 rounded-[10px] border px-2.5 text-left transition enabled:hover:-translate-y-px enabled:hover:shadow-md ${
        c.future || c.kind === "pending" ? "border-dashed border-line-strong text-ink-muted" : (CELL[c.kind] ?? "border-line bg-surface")
      }`}
    >
      {c.future || c.kind === "pending" ? (
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

// ---------- Editor de un día ----------

interface Row {
  id?: string;
  start: string;
  end: string;
  /** Tramo abierto (sigue trabajando) u olvidado. */
  open: boolean;
  missingEnd: boolean;
  deleted: boolean;
  original?: { start: string; end: string };
  /** Dónde fichó la entrada y la salida (si el local lo comprueba). */
  where?: string;
}

const REASONS = ["Olvidó fichar la salida", "Olvidó fichar la entrada", "Error al fichar", "Fichó en papel", "Cambio de turno"];

function DayEditor(props: {
  person: BoardPerson;
  cell: Cell;
  monday: string;
  changes: ClockChange[];
  actions: ClockActions;
  isDemo: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const { person, cell: c, monday, changes, actions, onClose, onSaved } = props;
  const dayIndex = Math.round((Date.parse(c.date) - Date.parse(monday)) / 86_400_000);
  const [rows, setRows] = useState<Row[]>(() =>
    c.records.map((r) => {
      const start = madridTime(r.start);
      const end = r.end ? madridTime(r.end) : "";
      const where = [r.placeIn ? `Entrada: ${placeText(r.placeIn, r.distIn).toLowerCase()}` : "", r.placeOut ? `Salida: ${placeText(r.placeOut, r.distOut).toLowerCase()}` : ""]
        .filter(Boolean)
        .join(" · ");
      return { id: r.id, start, end, open: !r.end && !r.missingEnd, missingEnd: r.missingEnd, deleted: false, original: { start, end }, where };
    }),
  );
  const [reason, setReason] = useState(c.kind === "forgot" ? REASONS[0] : "");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const changed = rows.filter((r) => (r.id ? r.deleted || r.start !== r.original?.start || r.end !== r.original?.end : !r.deleted));

  function update(i: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((rs) => [...rs, { start: c.shift?.start ?? "09:00", end: c.shift?.end ?? "17:00", open: false, missingEnd: false, deleted: false }]);
  }

  function save() {
    setError("");
    if (!changed.length) return onClose();
    if (reason.trim().length < 2) return setError("Indica el motivo del cambio. Queda guardado en el historial.");
    start(async () => {
      for (const r of changed) {
        const res = r.deleted
          ? await actions.deleteClock(r.id!, reason)
          : await actions.saveClock({ id: r.id, employeeId: person.id, date: c.date, start: r.start, end: r.end || null, reason });
        if (!res.ok) return setError(res.error);
      }
      onSaved(changed.length === 1 ? "Fichaje corregido. Queda en el historial." : `${changed.length} cambios guardados. Quedan en el historial.`);
    });
  }

  const nextDay = (r: Row) => r.end && r.end <= r.start;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div
        role="dialog"
        aria-label={`Fichajes de ${person.name}`}
        className="fixed inset-x-0 bottom-0 z-50 max-h-[92vh] overflow-y-auto rounded-t-2xl bg-surface p-5 shadow-xl sm:inset-x-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:w-[520px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className={ui.h2}>{person.name}</h2>
            <p className="text-sm text-ink-muted">
              {DAY_LONG[dayIndex]} {Number(c.date.slice(8))} · {c.shift ? `previsto ${c.shift.label} ${shiftTimes(c.shift)}` : "sin turno previsto"}
            </p>
          </div>
          <button aria-label="Cerrar" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-lg text-ink-muted hover:bg-ground">
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {rows.length === 0 && <p className="rounded-xl bg-ground px-4 py-3 text-sm text-ink-soft">No fichó este día.</p>}
          {rows.map((r, i) =>
            r.deleted ? (
              <div key={i} className="flex items-center justify-between rounded-xl border border-dashed border-line-strong px-3 py-2 text-sm text-ink-muted">
                <span className="line-through">
                  {r.original?.start}–{r.original?.end || "…"}
                </span>
                <button onClick={() => update(i, { deleted: false })} className="font-semibold text-accent">
                  Recuperar
                </button>
              </div>
            ) : (
              <div key={i} className={`grid grid-cols-[1fr_1fr_44px] items-end gap-2 rounded-xl border p-3 ${r.missingEnd && !r.end ? "border-danger/40 bg-danger-soft/40" : "border-line"}`}>
                <label className="flex flex-col gap-1 text-xs font-semibold text-ink-muted">
                  Entrada
                  <input type="time" value={r.start} onChange={(e) => update(i, { start: e.target.value })} className={ui.input} />
                </label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-ink-muted">
                  <span>
                    Salida {nextDay(r) && <span className="font-normal">(día siguiente)</span>}
                    {!r.end && <span className={`font-normal ${r.missingEnd ? "text-danger-ink" : ""}`}>{r.missingEnd ? " · sin fichar" : r.open ? " · sigue dentro" : ""}</span>}
                  </span>
                  <input type="time" value={r.end} onChange={(e) => update(i, { end: e.target.value })} className={ui.input} />
                </label>
                <button
                  onClick={() => (r.id ? update(i, { deleted: true }) : setRows((rs) => rs.filter((_, k) => k !== i)))}
                  aria-label="Quitar tramo"
                  className="flex h-11 w-11 items-center justify-center rounded-lg text-ink-muted hover:bg-danger-soft hover:text-danger-ink"
                >
                  ✕
                </button>
                {r.where && (
                  <p className={`col-span-3 text-[12px] ${/fuera/.test(r.where) ? "font-semibold text-danger-ink" : "text-ink-muted"}`}>📍 {r.where}</p>
                )}
              </div>
            ),
          )}
          <button onClick={addRow} className="min-h-11 self-start rounded-lg px-1 text-sm font-semibold text-accent hover:underline">
            + Añadir tramo
          </button>
        </div>

        {changed.length > 0 && (
          <div className="mt-4 rounded-xl bg-ground p-4">
            <label className={ui.label}>
              Motivo del cambio
              <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="Por qué lo corriges" className={ui.input} />
            </label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {REASONS.map((x) => (
                <button key={x} type="button" onClick={() => setReason(x)} className={`rounded-full border px-3 py-1 text-[13px] ${reason === x ? "border-ink bg-surface font-semibold" : "border-line-strong text-ink-soft hover:border-ink"}`}>
                  {x}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <p className={`${ui.error} mt-3`} role="alert">
            {error}
          </p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className={`${ui.btnSm} ${ui.secondary}`}>
            Cancelar
          </button>
          <button onClick={save} disabled={pending || !changed.length} className={`${ui.btnSm} ${ui.primary}`}>
            {pending ? "Guardando…" : changed.length ? "Guardar cambios" : "Sin cambios"}
          </button>
        </div>

        {changes.length > 0 && (
          <div className="mt-5 border-t border-[#EEEBE3] pt-4">
            <h3 className="mb-2 text-sm font-semibold">Historial de cambios</h3>
            <ul className="flex flex-col gap-2 text-[13px] text-ink-soft">
              {changes.map((ch, i) => (
                <li key={i}>
                  <span className="font-semibold text-ink">{ch.action === "crear" ? "Añadido" : ch.action === "borrar" ? "Borrado" : "Corregido"}</span>{" "}
                  {ch.before && `${madridTime(ch.before.entrada)}–${ch.before.salida ? madridTime(ch.before.salida) : "sin salida"}`}
                  {ch.before && ch.after && " → "}
                  {ch.after && `${madridTime(ch.after.entrada)}–${ch.after.salida ? madridTime(ch.after.salida) : "sin salida"}`} · «{ch.reason}»
                  <span className="text-ink-muted"> · {madridDate(ch.at).split("-").reverse().join("/")} {madridTime(ch.at)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {props.isDemo && <p className="mt-4 text-[13px] text-ink-muted">En la demo los cambios no se guardan al salir.</p>}
      </div>
    </>
  );
}

// ---------- Exportar ----------

function ExportMenu({ monday, today, exportClock, onError }: { monday: string; today: string; exportClock: NonNullable<ClockActions["exportClock"]>; onError: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  const months = useMemo(() => {
    const list: string[] = [];
    const [y, m] = (monday > today ? today : monday).split("-").map(Number);
    for (let k = 0; k < 12; k++) list.push(new Date(Date.UTC(y, m - 1 - k, 1)).toISOString().slice(0, 7));
    return list;
  }, [monday, today]);
  const [month, setMonth] = useState(months[0]);

  return (
    <>
      <button onClick={() => setOpen(true)} className={`${ui.btn} ${ui.secondary}`}>
        Exportar registro…
      </button>
      {open && (
        <ExportChooser
          title="Exportar el registro de jornada"
          subtitle="Guarda tu copia cada mes o mándala a tu gestoría."
          before={{
            label: "¿De qué mes?",
            content: (
              <select value={month} onChange={(e) => setMonth(e.target.value)} className={`${ui.input} w-full`} aria-label="Mes">
                {months.map((m) => (
                  <option key={m} value={m}>
                    {monthOption(m)}
                  </option>
                ))}
              </select>
            ),
          }}
          models={CLOCK_MODELS}
          storageKey="rotafy:exportar-fichajes"
          onClose={() => setOpen(false)}
          onDownload={async (model, format) => {
            try {
              const res = await exportClock(month);
              if (!res.ok) return onError(res.error);
              const table = clockTable(model, res.rows, res.month, res.localName, new Date(res.now));
              const suffix = model === "detail" ? "" : model === "summary" ? "-resumen" : "-por-dia";
              if (format === "csv") saveBlob(new Blob([tableCsv(table)], { type: "text/csv;charset=utf-8" }), `${res.fileBase}${suffix}.csv`);
              else saveBlob(await tablesToXlsx([table]), `${res.fileBase}${suffix}.xlsx`);
              setOpen(false);
            } catch {
              onError("No se ha podido crear el archivo. Inténtalo de nuevo.");
            }
          }}
        />
      )}
    </>
  );
}
