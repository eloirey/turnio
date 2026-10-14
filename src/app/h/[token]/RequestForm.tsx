"use client";

import { useActionState, useState } from "react";
import { ui } from "@/components/ui";
import { DAY_LONG, dayOfMonth } from "@/lib/dates";
import { submitRequest, type RequestState } from "./actions";

interface Props {
  token: string;
  weeks: { id: string; monday: string; label: string; workDays: number[] }[];
  mates: { id: string; nombre: string }[];
}

export function RequestForm({ token, weeks, mates }: Props) {
  const [open, setOpen] = useState(false);
  const [weekId, setWeekId] = useState(weeks[0]?.id ?? "");
  const [tipo, setTipo] = useState<"librar" | "intercambio">("librar");
  const [state, action, pending] = useActionState<RequestState, FormData>(submitRequest.bind(null, token), {});

  const week = weeks.find((w) => w.id === weekId);
  const days = tipo === "librar" ? (week?.workDays ?? []) : [0, 1, 2, 3, 4, 5, 6];

  if (weeks.length === 0) return null;

  if (!open || state.ok) {
    return (
      <div className="flex flex-col gap-3">
        {state.ok && <p className={ui.success} role="status">Solicitud enviada. Tu encargado la verá en Rotafy.</p>}
        <button onClick={() => setOpen(true)} className={`${ui.btn} h-[52px] w-full bg-ink text-white`}>
          Pedir un cambio
        </button>
      </div>
    );
  }

  return (
    <form action={action} className={`${ui.card} flex flex-col gap-4 p-5`}>
      <h2 className={ui.h2}>Pedir un cambio</h2>

      {weeks.length > 1 && (
        <label className={ui.label}>
          Semana
          <select name="weekId" value={weekId} onChange={(e) => setWeekId(e.target.value)} className={ui.input}>
            {weeks.map((w) => (
              <option key={w.id} value={w.id}>
                {w.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {weeks.length === 1 && <input type="hidden" name="weekId" value={weekId} />}

      <fieldset className="grid grid-cols-2 gap-2">
        <legend className="mb-1.5 text-sm font-semibold">¿Qué necesitas?</legend>
        {(["librar", "intercambio"] as const).map((t) => (
          <label key={t} className={`flex min-h-12 cursor-pointer items-center justify-center rounded-[10px] border text-sm font-semibold ${tipo === t ? "border-2 border-ink bg-ground" : "border-line-strong"}`}>
            <input type="radio" name="tipo" value={t} checked={tipo === t} onChange={() => setTipo(t)} className="sr-only" />
            {t === "librar" ? "Librar un día" : "Cambiar con alguien"}
          </label>
        ))}
      </fieldset>

      {days.length === 0 ? (
        <p className="text-sm text-ink-muted">No trabajas ningún día esa semana.</p>
      ) : (
        <label className={ui.label}>
          Día
          <select name="dia" required className={ui.input} defaultValue={days[0]}>
            {days.map((d) => (
              <option key={d} value={d}>
                {DAY_LONG[d]} {week ? dayOfMonth(week.monday, d) : ""}
              </option>
            ))}
          </select>
        </label>
      )}

      {tipo === "intercambio" && (
        <label className={ui.label}>
          Con quién
          <select name="conEmpleadoId" required className={ui.input} defaultValue="">
            <option value="" disabled>
              Elige un compañero
            </option>
            {mates.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </select>
          <span className="text-xs font-normal text-ink-muted">Habladlo antes: así tu encargado solo tiene que aceptarlo.</span>
        </label>
      )}

      <label className={ui.label}>
        Motivo (opcional)
        <textarea name="mensaje" maxLength={500} rows={2} className={`${ui.input} h-auto py-2`} />
      </label>

      {state.error && <p className={ui.error} role="alert">{state.error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setOpen(false)} className={`${ui.btn} ${ui.secondary}`}>
          Cancelar
        </button>
        <button type="submit" disabled={pending || days.length === 0} className={`${ui.btn} ${ui.primary}`}>
          {pending ? "Enviando…" : "Enviar"}
        </button>
      </div>
    </form>
  );
}
