"use client";

import { useState, useTransition } from "react";
import { ui } from "@/components/ui";
import { ABSENCE_LABELS, type AbsenceReason, type AusenciaRow, type EmployeeRecord } from "@/lib/data/mappers";
import { rangeLabel, shortDateLabel } from "@/lib/dates";
import type { EmployeeActions } from "./EmpleadosManager";

export function AbsencesCard(props: {
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
