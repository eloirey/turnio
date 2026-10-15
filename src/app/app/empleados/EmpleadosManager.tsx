"use client";

import { useState, useTransition } from "react";
import { useConfirm, useToast } from "@/components/feedback";
import { NavLink, useIsDemo } from "@/components/nav";
import { ui } from "@/components/ui";
import { ABSENCE_LABELS, type AbsenceReason, type AusenciaRow, type EmployeeRecord } from "@/lib/data/mappers";
import { DAY_LONG, DAY_SHORT, rangeLabel, shortDateLabel } from "@/lib/dates";
import { employeePath } from "@/lib/employee-link";
import { roleMap, roleStyle, type Role } from "@/lib/roles";
import { activeSlots, type Rules, type ShiftCatalog, type Slot } from "@/lib/schedule/types";
import { whatsappLink } from "@/lib/whatsapp";
import * as serverActions from "./actions";

export interface EmployeeActions {
  saveEmployee: typeof serverActions.saveEmployee;
  deleteEmployee: typeof serverActions.deleteEmployee;
  newLink: typeof serverActions.newLink;
  addAbsence: typeof serverActions.addAbsence;
  deleteAbsence: typeof serverActions.deleteAbsence;
}

interface Draft {
  id?: string;
  nombre: string;
  puesto: string;
  horasContrato: string;
  telefono: string;
  availability: Record<Slot, boolean[]>;
  minDaysOff: number | null;
  maxConsecutiveClosings: number | null;
  preferredDaysOff: number[];
}

const allWeek = () => Array<boolean>(7).fill(true);

function newDraft(roles: Role[], slots: Slot[]): Draft {
  return {
    nombre: "",
    puesto: roles[0]?.key ?? "",
    horasContrato: "40",
    telefono: "",
    availability: Object.fromEntries(slots.map((s) => [s, allWeek()])),
    minDaysOff: null,
    maxConsecutiveClosings: null,
    preferredDaysOff: [],
  };
}

function toDraft(e: EmployeeRecord, slots: Slot[]): Draft {
  return {
    id: e.id,
    nombre: e.name,
    puesto: e.role,
    horasContrato: String(e.contractHours),
    telefono: e.phone ?? "",
    availability: Object.fromEntries(slots.map((s) => [s, [...(e.availability[s] ?? Array<boolean>(7).fill(false))]])),
    minDaysOff: e.minDaysOff ?? null,
    maxConsecutiveClosings: e.maxConsecutiveClosings ?? null,
    preferredDaysOff: [...(e.preferredDaysOff ?? [])],
  };
}

interface Props {
  employees: EmployeeRecord[];
  roles: Role[];
  shifts: ShiftCatalog;
  rules: Rules;
  absences: AusenciaRow[];
  today: string;
  baseUrl: string;
  localName: string;
  firstTime: boolean;
  /** La demo guarda en memoria; la app, en el servidor. */
  actions?: EmployeeActions;
}

export function EmpleadosManager({ employees, roles, shifts, rules, absences, today, baseUrl, localName, firstTime, actions = serverActions }: Props) {
  const slots = activeSlots(shifts);
  const isDemo = useIsDemo();
  const [draft, setDraft] = useState<Draft>(() => (employees[0] ? toDraft(employees[0], slots) : newDraft(roles, slots)));
  const [showRules, setShowRules] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const { confirm, view: confirmView } = useConfirm();
  const roleById = roleMap(roles);

  const current = draft.id ? employees.find((e) => e.id === draft.id) : undefined;
  const personalLink = current ? `${baseUrl}/h/${employeePath(current.name, current.token)}` : "";
  const myAbsences = current ? absences.filter((a) => a.empleado_id === current.id) : [];
  const absentNow = (id: string) => absences.find((a) => a.empleado_id === id && a.desde <= today && a.hasta >= today);

  function select(e: EmployeeRecord | null) {
    setError("");
    setDraft(e ? toDraft(e, slots) : newDraft(roles, slots));
  }

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function toggle(slot: Slot, day: number) {
    update("availability", { ...draft.availability, [slot]: draft.availability[slot].map((v, i) => (i === day ? !v : v)) });
  }

  function setRow(slot: Slot, value: boolean) {
    update("availability", { ...draft.availability, [slot]: Array<boolean>(7).fill(value) });
  }

  function save() {
    setError("");
    startTransition(async () => {
      const res = await actions.saveEmployee({
        id: draft.id,
        nombre: draft.nombre,
        puesto: draft.puesto,
        horasContrato: Number(draft.horasContrato),
        telefono: draft.telefono,
        availability: draft.availability,
        minDaysOff: draft.minDaysOff,
        maxConsecutiveClosings: draft.maxConsecutiveClosings,
        preferredDaysOff: draft.preferredDaysOff,
      });
      if (!res.ok) return setError(res.error);
      const isNew = !draft.id;
      setDraft((d) => ({ ...d, id: res.id }));
      toast.show(isNew ? `${draft.nombre} se ha unido al equipo.` : "Cambios guardados.");
    });
  }

  async function remove() {
    if (!draft.id) return;
    const ok = await confirm({
      title: `¿Eliminar a ${draft.nombre}?`,
      body: "Se quitan sus turnos y su enlace deja de funcionar. Si ha fichado alguna vez, su registro de jornada se conserva (la ley obliga a guardarlo 4 años).",
      confirmLabel: "Eliminar",
      danger: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await actions.deleteEmployee(draft.id!);
      if (!res.ok) return setError(res.error);
      toast.show(res.archived ? `${draft.nombre} ya no está en el equipo. Sus fichajes se conservan.` : `${draft.nombre} ya no está en el equipo.`);
      const rest = employees.filter((e) => e.id !== draft.id);
      setDraft(rest[0] ? toDraft(rest[0], slots) : newDraft(roles, slots));
    });
  }

  async function changeLink() {
    if (!current) return;
    const ok = await confirm({
      title: `¿Cambiar el enlace de ${current.name}?`,
      body: "El enlace actual dejará de funcionar al momento. Úsalo si lo ha perdido o si lo ha compartido con alguien. Después envíale el nuevo.",
      confirmLabel: "Cambiar enlace",
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await actions.newLink(current.id);
      if (!res.ok) return setError(res.error);
      toast.show("Enlace nuevo creado. Envíaselo a " + current.name + ".");
    });
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(personalLink);
      toast.show("Enlace copiado.");
    } catch {
      toast.show({ message: "No se ha podido copiar. Selecciona el enlace y cópialo a mano.", tone: "error" });
    }
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className={ui.h1}>Equipo</h1>
          <p className="mt-1.5 text-[15px] text-ink-soft">
            {employees.length === 0 ? "Añade a las personas que trabajan contigo." : `${employees.length} ${employees.length === 1 ? "persona" : "personas"}. Con estos datos se genera el cuadrante.`}
          </p>
        </div>
        <button onClick={() => select(null)} className={`${ui.btn} ${ui.primary}`}>
          + Añadir persona
        </button>
      </div>

      {firstTime && (
        <div className="mb-6 rounded-2xl bg-accent px-5 py-4 text-[15px] text-white">
          <strong>¡Tu negocio está listo!</strong> Ahora añade a tu equipo: nombre, puesto, horas de contrato y cuándo puede trabajar cada persona.
        </div>
      )}

      <div className="flex flex-wrap items-start gap-6">
        {/* ---------- Lista ---------- */}
        <section aria-label="Personas" className={`${ui.card} w-full p-2 lg:sticky lg:top-24 lg:w-auto lg:flex-[1_1_280px]`}>
          {employees.length === 0 && <p className="p-4 text-sm text-ink-muted">Todavía no hay nadie. Empieza con el formulario.</p>}
          {!draft.id && employees.length > 0 && (
            <div className="flex min-h-14 items-center gap-3 rounded-xl bg-accent-soft p-3 outline outline-1 outline-[#B9CFC2]">
              <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-dashed border-accent text-accent">+</span>
              <span className="text-[15px] font-semibold text-accent-ink">Nueva persona</span>
            </div>
          )}
          {employees.map((e) => {
            const selected = draft.id === e.id;
            const away = absentNow(e.id);
            return (
              <button
                key={e.id}
                onClick={() => select(e)}
                className={`flex min-h-14 w-full items-center gap-3 rounded-xl p-3 text-left ${selected ? "bg-accent-soft outline outline-1 outline-[#B9CFC2]" : "hover:bg-ground"}`}
              >
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-sm font-bold" style={roleStyle(roleById[e.role]?.color)}>
                  {e.name.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{e.name}</span>
                  <span className="block truncate text-xs text-ink-muted">
                    {roleById[e.role]?.name ?? e.role} · {e.contractHours} h/sem
                  </span>
                </span>
                {away && (
                  <span className="flex-none rounded-full bg-pending-soft px-2 py-0.5 text-[11px] font-semibold text-pending-ink">
                    {ABSENCE_LABELS[away.motivo]}
                  </span>
                )}
              </button>
            );
          })}
        </section>

        {/* ---------- Ficha ---------- */}
        <section aria-label="Ficha" className="flex min-w-0 flex-[999_1_620px] flex-col gap-5">
          <div className={`${ui.card} p-6`}>
            <h2 className={`${ui.h2} mb-4`}>{draft.id ? draft.nombre || "Sin nombre" : "Nueva persona"}</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className={ui.label}>
                Nombre
                <input value={draft.nombre} onChange={(e) => update("nombre", e.target.value)} maxLength={80} placeholder="Ana" className={ui.input} autoFocus={!draft.id} />
              </label>
              <label className={ui.label}>
                Puesto
                <select value={draft.puesto} onChange={(e) => update("puesto", e.target.value)} className={ui.input}>
                  {roles.map((r) => (
                    <option key={r.key} value={r.key}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={ui.label}>
                Horas de contrato a la semana
                <input type="number" inputMode="numeric" min={1} max={60} value={draft.horasContrato} onChange={(e) => update("horasContrato", e.target.value)} className={ui.input} />
              </label>
              <label className={ui.label}>
                <span>
                  Móvil <span className="font-normal text-ink-muted">· para enviarle su horario</span>
                </span>
                <input type="tel" inputMode="tel" value={draft.telefono} onChange={(e) => update("telefono", e.target.value)} placeholder="600 000 000" maxLength={20} className={ui.input} />
              </label>
            </div>
          </div>

          <div className={`${ui.card} p-6`}>
            <h2 className={ui.h2}>Disponibilidad</h2>
            <p className="mb-4 mt-1 text-sm text-ink-soft">Marca cuándo puede trabajar. El generador nunca le pondrá un turno fuera de lo marcado.</p>
            <div className="overflow-x-auto">
              <div className="flex min-w-[560px] flex-col gap-1.5">
                <div className="grid grid-cols-[112px_repeat(7,minmax(48px,1fr))_76px] items-center gap-1.5 text-[13px] font-semibold text-ink-muted">
                  <span />
                  {DAY_SHORT.map((d) => (
                    <span key={d} className="text-center">
                      {d}
                    </span>
                  ))}
                  <span />
                </div>
                {slots.map((slot) => {
                  const week = draft.availability[slot] ?? Array<boolean>(7).fill(false);
                  const all = week.every(Boolean);
                  return (
                    <div key={slot} className="grid grid-cols-[112px_repeat(7,minmax(48px,1fr))_76px] items-center gap-1.5">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold" title={shifts[slot].label}>
                          {shifts[slot].label}
                        </span>
                        <span className="block text-[11px] text-ink-muted tabular-nums">
                          {shifts[slot].start}–{shifts[slot].end}
                        </span>
                      </span>
                      {week.map((on, day) => (
                        <button
                          key={day}
                          type="button"
                          role="checkbox"
                          aria-checked={on}
                          aria-label={`${shifts[slot].label} del ${DAY_LONG[day]}`}
                          onClick={() => toggle(slot, day)}
                          className={`flex h-11 items-center justify-center rounded-lg border text-base transition ${on ? "border-accent bg-accent text-white" : "border-line-strong bg-surface text-transparent hover:border-ink"}`}
                        >
                          ✓
                        </button>
                      ))}
                      <button type="button" onClick={() => setRow(slot, !all)} className="h-11 rounded-lg text-xs font-semibold text-ink-muted hover:bg-ground">
                        {all ? "Ninguno" : "Todos"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className={`${ui.card} p-6`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className={ui.h2}>Preferencias y reglas propias</h2>
                <p className="mt-1 text-sm text-ink-soft">
                  {draft.preferredDaysOff.length || draft.minDaysOff !== null || draft.maxConsecutiveClosings !== null
                    ? summaryOf(draft, rules)
                    : "Sigue las reglas del negocio. Personalízalas si esta persona tiene un acuerdo distinto."}
                </p>
              </div>
              <button type="button" onClick={() => setShowRules((v) => !v)} aria-expanded={showRules} className={`${ui.btnSm} ${ui.secondary}`}>
                {showRules ? "Cerrar" : "Personalizar"}
              </button>
            </div>
            {showRules && (
              <div className="mt-5 flex flex-col gap-5">
                <div>
                  <div className="text-sm font-semibold">Prefiere librar</div>
                  <p className="mb-2 text-[13px] text-ink-muted">El generador intentará darle libre estos días, si se puede cubrir el resto.</p>
                  <div className="flex flex-wrap gap-1.5">
                    {DAY_SHORT.map((d, i) => {
                      const on = draft.preferredDaysOff.includes(i);
                      return (
                        <button
                          key={d}
                          type="button"
                          role="checkbox"
                          aria-checked={on}
                          onClick={() => update("preferredDaysOff", on ? draft.preferredDaysOff.filter((x) => x !== i) : [...draft.preferredDaysOff, i].sort())}
                          className={`h-11 min-w-14 rounded-lg border px-3 text-sm font-semibold transition ${on ? "border-accent bg-accent-soft text-accent-ink" : "border-line-strong text-ink-soft hover:border-ink"}`}
                        >
                          {d}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className={ui.label}>
                    Días libres a la semana
                    <select
                      value={draft.minDaysOff ?? ""}
                      onChange={(e) => update("minDaysOff", e.target.value === "" ? null : Number(e.target.value))}
                      className={ui.input}
                    >
                      <option value="">Como el negocio ({rules.minDaysOff})</option>
                      {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                        <option key={n} value={n}>
                          {n} {n === 1 ? "día" : "días"} como mínimo
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={ui.label}>
                    Cierres seguidos como máximo
                    <select
                      value={draft.maxConsecutiveClosings ?? ""}
                      onChange={(e) => update("maxConsecutiveClosings", e.target.value === "" ? null : Number(e.target.value))}
                      className={ui.input}
                    >
                      <option value="">Como el negocio ({rules.maxConsecutiveNights})</option>
                      {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                        <option key={n} value={n}>
                          {n} {n === 1 ? "cierre" : "cierres"}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <p className="text-[13px] text-ink-muted">
                  ¿Hay días que no puede trabajar nunca? Desmárcalos en la disponibilidad: eso es obligatorio para el generador, no una preferencia.
                </p>
              </div>
            )}
          </div>

          {error && (
            <p className={ui.error} role="alert">
              {error}
            </p>
          )}
          <div className="flex flex-wrap justify-between gap-2.5">
            {draft.id ? (
              <button onClick={remove} disabled={pending} className={`${ui.btn} ${ui.danger}`}>
                Eliminar
              </button>
            ) : (
              <span />
            )}
            <button onClick={save} disabled={pending} className={`${ui.btn} ${ui.primary}`}>
              {pending ? "Guardando…" : draft.id ? "Guardar cambios" : "Añadir al equipo"}
            </button>
          </div>

          {current && (
            <>
              <AbsencesCard employee={current} absences={myAbsences} today={today} onToast={toast.show} confirm={confirm} actions={actions} />

              <div className={`${ui.card} p-6`} data-tour="enlace">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className={ui.h2}>Enlace personal</h2>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-pending-soft px-2.5 py-1 text-[12px] font-semibold text-pending-ink">
                    <span aria-hidden>🔒</span> Solo para {current.name}
                  </span>
                </div>
                <p className="mb-3 mt-1 text-sm text-ink-soft">
                  {current.name} verá siempre su horario aquí, sin registrarse, podrá fichar y añadirlo a su calendario del móvil. Envíaselo una vez.
                  {isDemo && " (En la demo este enlace no funciona.)"}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-lg bg-ground px-3 py-2.5 text-sm">{personalLink}</code>
                  <button onClick={copyLink} className={`${ui.btnSm} ${ui.secondary}`}>
                    Copiar
                  </button>
                  <a
                    href={whatsappLink(
                      `Hola ${current.name}, aquí verás siempre tu horario de ${localName} y podrás fichar: ${personalLink}\n\nEs tu enlace personal: no lo compartas con nadie, porque con él se ficha a tu nombre.`,
                      current.phone,
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${ui.btnSm} ${ui.primary}`}
                  >
                    Enviar por WhatsApp
                  </a>
                </div>
                <p className="mt-3 rounded-lg bg-ground px-3 py-2.5 text-[13px] leading-relaxed text-ink-soft">
                  <strong className="text-ink">Es único y no se debe compartir:</strong> quien lo tenga puede ver el horario de {current.name} y fichar a su nombre. Si lo pierde o se lo pasa a alguien,{" "}
                  <button onClick={changeLink} disabled={pending} className="font-semibold text-accent underline underline-offset-2 hover:text-accent-ink disabled:opacity-50">
                    cambia el enlace
                  </button>{" "}
                  y el anterior dejará de funcionar.
                </p>
              </div>
            </>
          )}
          {!draft.id && (
            <p className="text-center text-[13px] text-ink-muted">
              ¿Falta algún puesto?{" "}
              <NavLink href="/app/ajustes" className="font-semibold text-accent underline-offset-2 hover:underline">
                Créalo en Ajustes
              </NavLink>
            </p>
          )}
        </section>
      </div>
      {toast.view}
      {confirmView}
    </>
  );
}

/** "Prefiere librar sáb y dom · 3 días libres · 1 cierre seguido" */
function summaryOf(d: Draft, rules: Rules): string {
  const parts: string[] = [];
  if (d.preferredDaysOff.length) parts.push(`Prefiere librar ${d.preferredDaysOff.map((i) => DAY_SHORT[i].toLowerCase()).join(", ")}`);
  if (d.minDaysOff !== null && d.minDaysOff !== rules.minDaysOff) parts.push(`${d.minDaysOff} ${d.minDaysOff === 1 ? "día libre" : "días libres"} a la semana`);
  if (d.maxConsecutiveClosings !== null && d.maxConsecutiveClosings !== rules.maxConsecutiveNights)
    parts.push(`máximo ${d.maxConsecutiveClosings} ${d.maxConsecutiveClosings === 1 ? "cierre seguido" : "cierres seguidos"}`);
  return parts.length ? parts.join(" · ") + "." : "Sigue las reglas del negocio.";
}

function AbsencesCard(props: {
  employee: EmployeeRecord;
  actions: EmployeeActions;
  absences: AusenciaRow[];
  today: string;
  onToast: (t: { message: string; tone?: "info" | "error" } | string) => void;
  confirm: (o: { title: string; body?: string; confirmLabel?: string; danger?: boolean }) => Promise<boolean>;
}) {
  const { employee, absences, today, onToast, confirm, actions } = props;
  const [open, setOpen] = useState(false);
  const [desde, setDesde] = useState(today);
  const [hasta, setHasta] = useState(today);
  const [motivo, setMotivo] = useState<AbsenceReason>("vacaciones");
  const [nota, setNota] = useState("");
  const [pending, start] = useTransition();

  function add() {
    start(async () => {
      const res = await actions.addAbsence({ empleadoId: employee.id, desde, hasta: hasta < desde ? desde : hasta, motivo, nota });
      if (!res.ok) return onToast({ message: res.error, tone: "error" });
      setOpen(false);
      setNota("");
      onToast(`${ABSENCE_LABELS[motivo]} de ${employee.name} guardada. El generador ya la tiene en cuenta.`);
    });
  }

  async function remove(a: AusenciaRow) {
    const ok = await confirm({ title: "¿Borrar esta ausencia?", body: `${ABSENCE_LABELS[a.motivo]}: ${rangeLabel(a.desde, a.hasta)}.`, confirmLabel: "Borrar", danger: true });
    if (!ok) return;
    start(async () => {
      const res = await actions.deleteAbsence(a.id);
      onToast(res.ok ? "Ausencia borrada." : { message: res.error, tone: "error" });
    });
  }

  return (
    <div className={`${ui.card} p-6`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className={ui.h2}>Ausencias</h2>
          <p className="mt-1 text-sm text-ink-soft">Vacaciones, bajas o permisos. Esos días no se le asignan turnos.</p>
        </div>
        {!open && (
          <button onClick={() => setOpen(true)} className={`${ui.btnSm} ${ui.secondary}`}>
            + Añadir ausencia
          </button>
        )}
      </div>

      {open && (
        <div className="mt-4 grid grid-cols-1 gap-3 rounded-xl bg-ground p-4 sm:grid-cols-2">
          <label className={ui.label}>
            Motivo
            <select value={motivo} onChange={(e) => setMotivo(e.target.value as AbsenceReason)} className={ui.input}>
              {(Object.keys(ABSENCE_LABELS) as AbsenceReason[]).map((k) => (
                <option key={k} value={k}>
                  {ABSENCE_LABELS[k]}
                </option>
              ))}
            </select>
          </label>
          <label className={ui.label}>
            Nota <span className="font-normal text-ink-muted">(opcional)</span>
            <input value={nota} onChange={(e) => setNota(e.target.value)} maxLength={200} placeholder="Viaje, médico…" className={ui.input} />
          </label>
          <label className={ui.label}>
            Desde
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className={ui.input} />
          </label>
          <label className={ui.label}>
            Hasta
            <input type="date" value={hasta} min={desde} onChange={(e) => setHasta(e.target.value)} className={ui.input} />
          </label>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <button onClick={() => setOpen(false)} className={`${ui.btnSm} ${ui.secondary}`}>
              Cancelar
            </button>
            <button onClick={add} disabled={pending || !desde} className={`${ui.btnSm} ${ui.primary}`}>
              {pending ? "Guardando…" : "Guardar ausencia"}
            </button>
          </div>
        </div>
      )}

      {absences.length > 0 ? (
        <ul className="mt-4 flex flex-col divide-y divide-[#EEEBE3]">
          {absences.map((a) => {
            const now = a.desde <= today && a.hasta >= today;
            return (
              <li key={a.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="text-[15px] font-semibold">
                    {ABSENCE_LABELS[a.motivo]} · {rangeLabel(a.desde, a.hasta)}
                    {now && <span className="ml-2 rounded-full bg-pending-soft px-2 py-0.5 text-[11px] font-semibold text-pending-ink">Ahora</span>}
                  </div>
                  {a.nota && <div className="truncate text-[13px] text-ink-muted">{a.nota}</div>}
                </div>
                <button onClick={() => remove(a)} disabled={pending} aria-label={`Borrar ausencia del ${shortDateLabel(a.desde)}`} className="flex h-10 w-10 flex-none items-center justify-center rounded-lg text-ink-muted hover:bg-ground">
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        !open && <p className="mt-3 text-sm text-ink-muted">No tiene ausencias próximas.</p>
      )}
    </div>
  );
}
