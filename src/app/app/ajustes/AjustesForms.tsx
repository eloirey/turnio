"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/feedback";
import { useIsDemo } from "@/components/nav";
import { NumberField } from "@/components/NumberField";
import { ui } from "@/components/ui";
import type { LocalSettings } from "@/lib/data/mappers";
import type { SettingsInput } from "@/lib/forms";
import { type Role } from "@/lib/roles";
import type { Rules } from "@/lib/schedule/types";
import * as serverActions from "./actions";
import { ManagersCard } from "./ManagersCard";
import { ClockPlaceSettings } from "./ClockPlaceSettings";
import { RolesCard } from "./RolesCard";
import { DangerCard } from "./DangerCard";

export interface SettingsActions {
  saveSettings: (input: SettingsInput) => Promise<serverActions.Result>;
  saveRoles: (input: serverActions.RolesInput) => Promise<serverActions.Result>;
  deleteAccount?: (confirmName: string) => Promise<serverActions.Result>;
  saveClockPlace?: typeof serverActions.saveClockPlace;
  clearClockPlace?: typeof serverActions.clearClockPlace;
  addClockWifi?: typeof serverActions.addClockWifi;
  removeClockWifi?: typeof serverActions.removeClockWifi;
}

/** Lo que se edita en el formulario (la ubicación y la wifi se guardan al momento). */
const editable = (s: LocalSettings) => ({ clockIn: s.clockIn, clockMarginMinutes: s.clockMarginMinutes, clockControl: s.clockControl, clockRadius: s.clockRadius });

interface Props {
  localName: string;
  roles: Role[];
  rules: Rules;
  settings: LocalSettings;
  usage: Record<string, number>;
  actions?: SettingsActions;
  /** El dueño puede borrar la cuenta; un encargado invitado, no. */
  isOwner?: boolean;
}

export function AjustesForms({ localName, roles, rules, settings, usage, actions = serverActions, isOwner = true }: Props) {
  const toast = useToast();
  const isDemo = useIsDemo();
  return (
    <div className="flex flex-col gap-6">
      {/* La key reinicia cada formulario con los datos del servidor tras guardar
          (así los puestos nuevos reciben su clave y no se duplican). */}
      <SettingsCards
        key={`${localName}|${JSON.stringify(rules)}|${JSON.stringify(editable(settings))}`}
        localName={localName}
        rules={rules}
        settings={settings}
        save={actions.saveSettings}
        actions={actions}
        onDone={(m) => toast.show(m)}
        onError={(m) => toast.show({ message: m, tone: "error" })}
      />
      <RolesCard
        key={JSON.stringify(roles)}
        roles={roles}
        usage={usage}
        save={actions.saveRoles}
        onDone={(m) => toast.show(m)}
        onError={(m) => toast.show({ message: m, tone: "error" })}
      />
      {!isDemo && <ManagersCard localName={localName} onDone={(m) => toast.show(m)} onError={(m) => toast.show({ message: m, tone: "error" })} />}
      {!isDemo && isOwner && actions.deleteAccount && <DangerCard localName={localName} remove={actions.deleteAccount} onError={(m) => toast.show({ message: m, tone: "error" })} />}
      {toast.view}
    </div>
  );
}

function SettingsCards(props: {
  localName: string;
  rules: Rules;
  settings: LocalSettings;
  save: SettingsActions["saveSettings"];
  actions: SettingsActions;
  onDone: (m: string) => void;
  onError: (m: string) => void;
}) {
  const { localName, rules, settings, save, actions, onDone, onError } = props;
  const [nombre, setNombre] = useState(localName);
  const [r, setR] = useState(rules);
  const [c, setC] = useState(() => editable(settings));
  const [pending, start] = useTransition();
  const dirty = nombre !== localName || JSON.stringify(r) !== JSON.stringify(rules) || JSON.stringify(c) !== JSON.stringify(editable(settings));

  function submit() {
    start(async () => {
      const res = await save({ nombre, ...r, ...c });
      if (res.ok) onDone("Ajustes guardados.");
      else onError(res.error);
    });
  }

  return (
    <>
      <section className={`${ui.card} p-6`}>
        <h2 className={`${ui.h2} mb-5`}>Tu negocio</h2>
        <label className={ui.label}>
          Nombre
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={120} className={ui.input} />
          <span className="text-xs font-normal text-ink-muted">Aparece en los mensajes que reciben tus empleados.</span>
        </label>
      </section>

      <section className={`${ui.card} p-6`}>
        <h2 className={ui.h2}>Reglas del cuadrante</h2>
        <p className="mb-4 mt-1 text-sm text-ink-soft">
          Valen para todo el equipo. Si alguien tiene un acuerdo distinto, cámbiaselo en su ficha (Equipo → Preferencias y reglas propias).
        </p>
        <div className="flex flex-col divide-y divide-[#EEEBE3]">
          <RuleRow
            title="Descanso mínimo entre jornadas"
            help="Horas desde que alguien acaba hasta que vuelve a empezar. El Estatuto de los Trabajadores exige 12."
            value={r.minRestHours}
            min={0}
            max={24}
            unit="h"
            onChange={(v) => setR({ ...r, minRestHours: v })}
            warn={r.minRestHours < 12 ? "Por debajo de lo que marca la ley (art. 34.3). Úsalo solo si tu convenio lo permite." : undefined}
          />
          <RuleRow
            title="Días libres mínimos por semana"
            help="Lo habitual en hostelería y comercio son 2."
            value={r.minDaysOff}
            min={0}
            max={6}
            unit={r.minDaysOff === 1 ? "día" : "días"}
            onChange={(v) => setR({ ...r, minDaysOff: v })}
            warn={r.minDaysOff < 2 ? "La ley garantiza día y medio de descanso semanal (art. 37.1). Con menos de 2, revisa tu convenio." : undefined}
          />
          <RuleRow
            title="Máximo de cierres seguidos"
            help="Días seguidos en franjas marcadas como cierre (las que acaban tarde)."
            value={r.maxConsecutiveNights}
            min={1}
            max={7}
            unit={r.maxConsecutiveNights === 1 ? "cierre" : "cierres"}
            onChange={(v) => setR({ ...r, maxConsecutiveNights: v })}
          />
          <RuleRow
            title="Horas extra permitidas"
            help="Horas por semana que el generador puede pasar del contrato si no hay otra forma de cubrir un turno."
            value={r.maxExtraHours}
            min={0}
            max={20}
            unit="h"
            onChange={(v) => setR({ ...r, maxExtraHours: v })}
            warn={r.maxExtraHours > 8 ? "Ojo: la ley limita las horas extra a 80 al año por persona (art. 35.2)." : undefined}
          />
        </div>
      </section>

      <section className={`${ui.card} p-6`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2 className={ui.h2}>Fichaje</h2>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-ink-soft">
              Cada persona ficha la entrada y la salida desde su enlace, sin instalar nada. Tú ves las horas, las incidencias y puedes corregir olvidos.
              Registrar la jornada es obligatorio en España desde 2019.
            </p>
            <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-ink-muted">
              Conservar el registro 4 años es responsabilidad de tu empresa, no de Rotafy: descarga el Excel cada mes desde Fichajes y guarda tu copia.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={c.clockIn}
            onClick={() => setC({ ...c, clockIn: !c.clockIn })}
            className={`relative h-8 w-14 flex-none rounded-full transition ${c.clockIn ? "bg-accent" : "bg-line-strong"}`}
          >
            <span className="sr-only">Activar fichaje</span>
            <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${c.clockIn ? "left-7" : "left-1"}`} />
          </button>
        </div>
        {c.clockIn && (
          <div className="mt-4 border-t border-[#EEEBE3] pt-2">
            <RuleRow
              title="Margen para retrasos"
              help="Minutos de cortesía antes de marcar que alguien entró tarde o salió antes."
              value={c.clockMarginMinutes}
              min={0}
              max={60}
              unit="min"
              onChange={(v) => setC({ ...c, clockMarginMinutes: v })}
            />
            <ClockPlaceSettings
              control={c.clockControl}
              radius={c.clockRadius}
              settings={settings}
              actions={actions}
              onControl={(v) => setC({ ...c, clockControl: v })}
              onRadius={(v) => setC({ ...c, clockRadius: v })}
              onDone={onDone}
              onError={onError}
            />
          </div>
        )}
      </section>

      <div className={`flex items-center justify-end gap-3 rounded-2xl transition ${dirty ? "sticky bottom-4 z-20 bg-ink/90 p-2 shadow-lg backdrop-blur" : "-mt-2"}`}>
        {dirty && <span className="mr-auto pl-3 text-sm font-medium text-white">Tienes cambios sin guardar</span>}
        <button onClick={submit} disabled={!dirty || pending} className={`${ui.btn} ${ui.primary}`}>
          {pending ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </>
  );
}

function RuleRow(props: { title: string; help: string; value: number; min: number; max: number; unit: string; onChange: (v: number) => void; warn?: string }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 py-4 first:pt-0">
      <div className="min-w-0 flex-1 basis-60">
        <div className="text-[15px] font-semibold">{props.title}</div>
        <div className="text-[13px] text-ink-muted">{props.help}</div>
        {props.warn && <div className="mt-1 text-[13px] font-medium text-danger-ink">{props.warn}</div>}
      </div>
      <NumberField label={props.title} value={props.value} min={props.min} max={props.max} unit={props.unit} onChange={props.onChange} />
    </div>
  );
}

