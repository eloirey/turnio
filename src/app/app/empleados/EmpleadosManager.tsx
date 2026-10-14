"use client";

import { useEffect, useState, useTransition } from "react";
import { ui } from "@/components/ui";
import type { EmployeeRecord } from "@/lib/data/mappers";
import { DAY_LONG, DAY_SHORT } from "@/lib/dates";
import { ROLES, ROLE_LABELS, ROLE_STYLES } from "@/lib/roles";
import { SLOTS, type Slot } from "@/lib/schedule/types";
import { whatsappLink } from "@/lib/whatsapp";
import { deleteEmployee, saveEmployee } from "./actions";

const SLOT_LABEL: Record<Slot, string> = { M: "Mañana", T: "Tarde", N: "Noche" };

interface Draft {
  id?: string;
  nombre: string;
  puesto: string;
  horasContrato: string; // texto mientras se escribe; se valida al guardar
  telefono: string;
  availability: Record<Slot, boolean[]>;
}

const allWeek = () => Array<boolean>(7).fill(true);

function newDraft(): Draft {
  return { nombre: "", puesto: "sala", horasContrato: "40", telefono: "", availability: { M: allWeek(), T: allWeek(), N: allWeek() } };
}

function toDraft(e: EmployeeRecord): Draft {
  return {
    id: e.id,
    nombre: e.name,
    puesto: e.role,
    horasContrato: String(e.contractHours),
    telefono: e.phone ?? "",
    availability: { M: [...e.availability.M], T: [...e.availability.T], N: [...e.availability.N] },
  };
}

interface Props {
  employees: EmployeeRecord[];
  baseUrl: string;
  localName: string;
  firstTime: boolean;
}

export function EmpleadosManager({ employees, baseUrl, localName, firstTime }: Props) {
  const [draft, setDraft] = useState<Draft | null>(() => (employees[0] ? toDraft(employees[0]) : newDraft()));
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 3000);
    return () => clearTimeout(t);
  }, [notice]);

  const current = draft?.id ? employees.find((e) => e.id === draft.id) : undefined;
  const personalLink = current ? `${baseUrl}/h/${current.token}` : "";

  function select(e: EmployeeRecord | null) {
    setError("");
    setDraft(e ? toDraft(e) : newDraft());
  }

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }

  function toggle(slot: Slot, day: number) {
    if (!draft) return;
    const next = { ...draft.availability, [slot]: draft.availability[slot].map((v, i) => (i === day ? !v : v)) };
    update("availability", next);
  }

  function setRow(slot: Slot, value: boolean) {
    if (!draft) return;
    update("availability", { ...draft.availability, [slot]: Array<boolean>(7).fill(value) });
  }

  function save() {
    if (!draft) return;
    setError("");
    startTransition(async () => {
      const res = await saveEmployee({
        id: draft.id,
        nombre: draft.nombre,
        puesto: draft.puesto as (typeof ROLES)[number],
        horasContrato: Number(draft.horasContrato),
        telefono: draft.telefono,
        availability: draft.availability,
      });
      if (!res.ok) return setError(res.error);
      setDraft((d) => (d ? { ...d, id: res.id } : d));
      setNotice(draft.id ? "Cambios guardados." : `${draft.nombre} añadido al equipo.`);
    });
  }

  function remove() {
    if (!draft?.id) return;
    if (!confirm(`¿Eliminar a ${draft.nombre}? Se borrarán también sus turnos.`)) return;
    startTransition(async () => {
      const res = await deleteEmployee(draft.id!);
      if (!res.ok) return setError(res.error);
      setNotice("Empleado eliminado.");
      const rest = employees.filter((e) => e.id !== draft.id);
      setDraft(rest[0] ? toDraft(rest[0]) : newDraft());
    });
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(personalLink);
      setNotice("Enlace copiado.");
    } catch {
      setError("No se ha podido copiar. Selecciona el enlace y cópialo a mano.");
    }
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className={ui.h1}>Empleados</h1>
          <p className="mt-1.5 text-[15px] text-ink-soft">Con estos datos Turnio genera el cuadrante.</p>
        </div>
        <button onClick={() => select(null)} className={`${ui.btn} ${ui.primary}`}>
          + Añadir empleado
        </button>
      </div>

      {firstTime && (
        <div className={`${ui.success} mb-6 text-[15px]`}>
          ¡Local creado! Ahora añade a tu equipo: nombre, puesto, horas de contrato y cuándo puede trabajar cada uno.
        </div>
      )}
      {notice && (
        <div role="status" className="mb-5 rounded-xl bg-ink px-4 py-3 text-[15px] text-white">
          {notice}
        </div>
      )}

      <div className="flex flex-wrap items-start gap-6">
        {/* Lista */}
        <section aria-label="Equipo" className={`${ui.card} flex-[1_1_260px] p-2.5`}>
          {employees.length === 0 && <p className="p-3 text-sm text-ink-muted">Aún no hay nadie. Empieza por el formulario.</p>}
          {employees.map((e) => {
            const selected = draft?.id === e.id;
            return (
              <button
                key={e.id}
                onClick={() => select(e)}
                className={`flex min-h-14 w-full items-center gap-3 rounded-[10px] p-3 text-left ${selected ? "bg-accent-soft outline outline-1 outline-[#B9CFC2]" : "hover:bg-ground"}`}
              >
                <span className={`flex h-9 w-9 flex-none items-center justify-center rounded-full text-sm font-semibold ${ROLE_STYLES[e.role] ?? "bg-line"}`}>
                  {e.name.charAt(0).toUpperCase()}
                </span>
                <span className="flex flex-col">
                  <span className="text-[15px] font-semibold">{e.name}</span>
                  <span className="text-xs text-ink-muted">
                    {ROLE_LABELS[e.role] ?? e.role} · {e.contractHours} h/sem
                  </span>
                </span>
              </button>
            );
          })}
        </section>

        {/* Ficha */}
        {draft && (
          <section aria-label="Ficha del empleado" className="flex min-w-0 flex-[999_1_620px] flex-col gap-5">
            <div className={`${ui.card} p-6`}>
              <h2 className={`${ui.h2} mb-4`}>{draft.id ? draft.nombre || "Sin nombre" : "Nuevo empleado"}</h2>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
                <label className={ui.label}>
                  Nombre
                  <input value={draft.nombre} onChange={(e) => update("nombre", e.target.value)} maxLength={80} className={ui.input} />
                </label>
                <label className={ui.label}>
                  Puesto
                  <select value={draft.puesto} onChange={(e) => update("puesto", e.target.value)} className={ui.input}>
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={ui.label}>
                  Horas de contrato / semana
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={draft.horasContrato}
                    onChange={(e) => update("horasContrato", e.target.value)}
                    className={ui.input}
                  />
                </label>
                <label className={ui.label}>
                  Teléfono (para avisos)
                  <input
                    type="tel"
                    value={draft.telefono}
                    onChange={(e) => update("telefono", e.target.value)}
                    placeholder="600 000 000"
                    maxLength={20}
                    className={ui.input}
                  />
                </label>
              </div>
            </div>

            <div className={`${ui.card} p-6`}>
              <h2 className={ui.h2}>Disponibilidad</h2>
              <p className="mb-4 mt-1 text-sm text-ink-soft">Toca para marcar o desmarcar las franjas en las que puede trabajar.</p>
              <div className="overflow-x-auto">
                <div className="flex min-w-[600px] flex-col gap-1.5">
                  <div className="grid grid-cols-[92px_repeat(7,minmax(52px,1fr))_76px] items-center gap-1.5 text-[13px] font-semibold text-ink-muted">
                    <span />
                    {DAY_SHORT.map((d) => (
                      <span key={d} className="text-center">
                        {d}
                      </span>
                    ))}
                    <span />
                  </div>
                  {SLOTS.map((slot) => (
                    <div key={slot} className="grid grid-cols-[92px_repeat(7,minmax(52px,1fr))_76px] items-center gap-1.5">
                      <span className="text-sm font-semibold">{SLOT_LABEL[slot]}</span>
                      {draft.availability[slot].map((on, day) => (
                        <button
                          key={day}
                          type="button"
                          role="checkbox"
                          aria-checked={on}
                          aria-label={`${SLOT_LABEL[slot]} del ${DAY_LONG[day]}`}
                          onClick={() => toggle(slot, day)}
                          className={`flex h-11 items-center justify-center rounded-lg border ${on ? "border-accent bg-accent text-white" : "border-line-strong bg-surface text-transparent"}`}
                        >
                          ✓
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setRow(slot, !draft.availability[slot].every(Boolean))}
                        className="h-11 rounded-lg text-xs font-semibold text-ink-muted hover:bg-ground"
                      >
                        {draft.availability[slot].every(Boolean) ? "Ninguno" : "Todos"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {current && (
              <div className={`${ui.card} p-6`}>
                <h2 className={ui.h2}>Enlace personal</h2>
                <p className="mb-3 mt-1 text-sm text-ink-soft">
                  {current.name} verá siempre su horario aquí, sin registrarse. Envíaselo una vez y guárdalo en el móvil.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-lg bg-ground px-3 py-2.5 text-sm">{personalLink}</code>
                  <button onClick={copyLink} className={`${ui.btnSm} ${ui.secondary}`}>
                    Copiar
                  </button>
                  <a
                    href={whatsappLink(`Hola ${current.name}, aquí verás siempre tu horario de ${localName}: ${personalLink}`, current.phone)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${ui.btnSm} ${ui.primary}`}
                  >
                    Enviar por WhatsApp
                  </a>
                </div>
              </div>
            )}

            {error && <p className={ui.error} role="alert">{error}</p>}
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
          </section>
        )}
      </div>
    </>
  );
}
