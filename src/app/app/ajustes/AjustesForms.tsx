"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/feedback";
import { ui } from "@/components/ui";
import { PALETTE, roleStyle, type Role } from "@/lib/roles";
import type { Rules } from "@/lib/schedule/types";
import { saveRoles, saveSettings } from "./actions";

interface Props {
  localName: string;
  roles: Role[];
  rules: Rules;
  usage: Record<string, number>;
}

interface DraftRole {
  key?: string;
  name: string;
  color: number;
  /** Id solo para React (las filas nuevas aún no tienen clave). */
  uid: string;
}

export function AjustesForms({ localName, roles, rules, usage }: Props) {
  const toast = useToast();
  return (
    <div className="flex flex-col gap-6">
      {/* La key reinicia cada formulario con los datos del servidor tras guardar
          (así los puestos nuevos reciben su clave y no se duplican). */}
      <SettingsCard
        key={`${localName}|${JSON.stringify(rules)}`}
        localName={localName}
        rules={rules}
        onDone={(m) => toast.show(m)}
        onError={(m) => toast.show({ message: m, tone: "error" })}
      />
      <RolesCard
        key={JSON.stringify(roles)}
        roles={roles}
        usage={usage}
        onDone={(m) => toast.show(m)}
        onError={(m) => toast.show({ message: m, tone: "error" })}
      />
      {toast.view}
    </div>
  );
}

function SettingsCard({ localName, rules, onDone, onError }: { localName: string; rules: Rules; onDone: (m: string) => void; onError: (m: string) => void }) {
  const [nombre, setNombre] = useState(localName);
  const [r, setR] = useState(rules);
  const [pending, start] = useTransition();
  const dirty = nombre !== localName || r.maxConsecutiveNights !== rules.maxConsecutiveNights || r.minRestHours !== rules.minRestHours || r.minDaysOff !== rules.minDaysOff;

  function save() {
    start(async () => {
      const res = await saveSettings({ nombre, ...r });
      if (res.ok) onDone("Ajustes guardados.");
      else onError(res.error);
    });
  }

  return (
    <section className={`${ui.card} p-6`}>
      <h2 className={`${ui.h2} mb-5`}>Tu local y reglas</h2>
      <label className={`${ui.label} mb-6`}>
        Nombre del local
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={120} className={ui.input} />
        <span className="text-xs font-normal text-ink-muted">Aparece en los mensajes que reciben tus empleados.</span>
      </label>

      <div className="flex flex-col divide-y divide-[#EEEBE3]">
        <RuleRow
          title="Descanso mínimo entre jornadas"
          help="El Estatuto de los Trabajadores exige al menos 12 horas."
          value={r.minRestHours}
          options={[8, 9, 10, 11, 12, 13, 14]}
          unit="h"
          onChange={(v) => setR({ ...r, minRestHours: v })}
          warn={r.minRestHours < 12 ? "Por debajo de lo que marca la ley. Úsalo solo si tu convenio lo permite." : undefined}
        />
        <RuleRow
          title="Días libres mínimos por semana"
          help="Lo habitual en hostelería y comercio son 2."
          value={r.minDaysOff}
          options={[1, 2, 3]}
          unit={r.minDaysOff === 1 ? "día" : "días"}
          onChange={(v) => setR({ ...r, minDaysOff: v })}
        />
        <RuleRow
          title="Máximo de cierres seguidos"
          help="Noches consecutivas que puede hacer una misma persona."
          value={r.maxConsecutiveNights}
          options={[1, 2, 3, 4, 5, 6, 7]}
          unit={r.maxConsecutiveNights === 1 ? "noche" : "noches"}
          onChange={(v) => setR({ ...r, maxConsecutiveNights: v })}
        />
      </div>

      <div className="mt-5 flex justify-end">
        <button onClick={save} disabled={!dirty || pending} className={`${ui.btn} ${ui.primary}`}>
          {pending ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </section>
  );
}

function RuleRow(props: { title: string; help: string; value: number; options: number[]; unit: string; onChange: (v: number) => void; warn?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0">
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-semibold">{props.title}</div>
        <div className="text-[13px] text-ink-muted">{props.help}</div>
        {props.warn && <div className="mt-1 text-[13px] font-medium text-danger-ink">{props.warn}</div>}
      </div>
      <label className="flex items-center gap-2 text-sm text-ink-soft">
        <select value={props.value} onChange={(e) => props.onChange(Number(e.target.value))} className={`${ui.input} w-20`} aria-label={props.title}>
          {props.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        {props.unit}
      </label>
    </div>
  );
}

let uidCounter = 0;
const newUid = () => `n${++uidCounter}`;

function RolesCard({ roles, usage, onDone, onError }: { roles: Role[]; usage: Record<string, number>; onDone: (m: string) => void; onError: (m: string) => void }) {
  const initial = roles.map((r) => ({ ...r, uid: r.key }));
  const [list, setList] = useState<DraftRole[]>(initial);
  const [pending, start] = useTransition();
  const dirty = JSON.stringify(list.map(({ key, name, color }) => ({ key, name, color }))) !== JSON.stringify(roles.map(({ key, name, color }) => ({ key, name, color })));

  function update(uid: string, patch: Partial<DraftRole>) {
    setList((l) => l.map((r) => (r.uid === uid ? { ...r, ...patch } : r)));
  }

  function add() {
    const used = new Set(list.map((r) => r.color));
    const color = PALETTE.findIndex((_, i) => !used.has(i));
    setList((l) => [...l, { name: "", color: color === -1 ? l.length % PALETTE.length : color, uid: newUid() }]);
  }

  function save() {
    start(async () => {
      const res = await saveRoles(list.map(({ key, name, color }) => ({ key, name, color })));
      if (res.ok) onDone("Puestos guardados.");
      else onError(res.error);
    });
  }

  return (
    <section className={`${ui.card} p-6`}>
      <h2 className={ui.h2}>Puestos</h2>
      <p className="mb-5 mt-1 text-sm text-ink-soft">Los puestos de tu equipo, con un color para reconocerlos en el cuadrante.</p>

      <ul className="flex flex-col gap-3">
        {list.map((r) => {
          const people = r.key ? (usage[r.key] ?? 0) : 0;
          return (
            <li key={r.uid} className="rounded-xl border border-line p-3">
              <div className="flex items-center gap-2">
                <span className="flex h-11 min-w-0 flex-1 items-center rounded-[10px] px-1" style={roleStyle(r.color)}>
                  <input
                    value={r.name}
                    onChange={(e) => update(r.uid, { name: e.target.value })}
                    placeholder="Nombre del puesto"
                    maxLength={40}
                    aria-label="Nombre del puesto"
                    className="h-9 w-full rounded-lg bg-white/60 px-2.5 text-[15px] font-semibold outline-none placeholder:font-normal focus:bg-white"
                    style={{ color: roleStyle(r.color).color }}
                  />
                </span>
                <button
                  onClick={() => setList((l) => l.filter((x) => x.uid !== r.uid))}
                  disabled={people > 0}
                  title={people > 0 ? `Tiene ${people} ${people === 1 ? "persona" : "personas"}: cámbiales el puesto antes de quitarlo` : "Quitar puesto"}
                  aria-label={`Quitar ${r.name || "puesto"}`}
                  className="flex h-11 w-11 flex-none items-center justify-center rounded-[10px] text-ink-muted hover:bg-ground disabled:cursor-not-allowed disabled:opacity-30"
                >
                  ✕
                </button>
              </div>
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Color">
                {PALETTE.map((p, i) => (
                  <button
                    key={p.name}
                    role="radio"
                    aria-checked={r.color === i}
                    aria-label={p.name}
                    onClick={() => update(r.uid, { color: i })}
                    className={`h-7 w-7 rounded-full ${r.color === i ? "ring-2 ring-ink ring-offset-2" : ""}`}
                    style={{ backgroundColor: p.bg, boxShadow: `inset 0 0 0 1px ${p.fg}40` }}
                  />
                ))}
                <span className="ml-auto text-xs text-ink-muted">{people ? `${people} ${people === 1 ? "persona" : "personas"}` : r.key ? "Sin personas" : "Nuevo"}</span>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex flex-wrap justify-between gap-2.5">
        <button onClick={add} className={`${ui.btn} ${ui.secondary}`}>
          + Añadir puesto
        </button>
        <button onClick={save} disabled={!dirty || pending} className={`${ui.btn} ${ui.primary}`}>
          {pending ? "Guardando…" : "Guardar puestos"}
        </button>
      </div>
    </section>
  );
}
