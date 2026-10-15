"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/feedback";
import { useIsDemo } from "@/components/nav";
import { NumberField } from "@/components/NumberField";
import { ui } from "@/components/ui";
import type { ClockControl, LocalSettings } from "@/lib/data/mappers";
import type { SettingsInput } from "@/lib/forms";
import { PALETTE, roleStyle, type Role } from "@/lib/roles";
import type { Rules } from "@/lib/schedule/types";
import * as serverActions from "./actions";
import { ManagersCard } from "./ManagersCard";

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

interface DraftRole {
  key?: string;
  name: string;
  color: number;
  /** Id solo para React (las filas nuevas aún no tienen clave). */
  uid: string;
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

function DangerCard({ localName, remove, onError }: { localName: string; remove: (name: string) => Promise<serverActions.Result>; onError: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  return (
    <section className="rounded-2xl border border-danger/30 bg-surface p-6">
      <h2 className={ui.h2}>Borrar la cuenta</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Se borra tu cuenta y todo lo de «{localName}»: equipo, cuadrantes, fichajes e historial. Los enlaces de tu equipo dejarán de funcionar. No se puede deshacer. Si usas el fichaje, descarga antes el registro de jornada (Fichajes → Exportar registro).
      </p>
      {!open ? (
        <button onClick={() => setOpen(true)} className={`${ui.btnSm} ${ui.danger} mt-4`}>
          Quiero borrar mi cuenta
        </button>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          <label className={ui.label}>
            Para confirmar, escribe «{localName}»
            <input value={text} onChange={(e) => setText(e.target.value)} className={ui.input} autoComplete="off" />
          </label>
          <div className="flex flex-wrap justify-end gap-2">
            <button onClick={() => setOpen(false)} className={`${ui.btnSm} ${ui.secondary}`}>
              Cancelar
            </button>
            <button
              onClick={() =>
                start(async () => {
                  const res = await remove(text);
                  if (!res.ok) onError(res.error);
                })
              }
              disabled={pending || text.trim().toLowerCase() !== localName.trim().toLowerCase()}
              className={`${ui.btnSm} bg-danger text-white hover:bg-danger-ink`}
            >
              {pending ? "Borrando…" : "Borrar todo para siempre"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

let uidCounter = 0;
const newUid = () => `n${++uidCounter}`;

function RolesCard({
  roles,
  usage,
  save: saveRoles,
  onDone,
  onError,
}: {
  roles: Role[];
  usage: Record<string, number>;
  save: SettingsActions["saveRoles"];
  onDone: (m: string) => void;
  onError: (m: string) => void;
}) {
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

const CONTROL_OPTIONS: { key: ClockControl; title: string; detail: string }[] = [
  { key: "no", title: "Desde cualquier sitio", detail: "No se comprueba dónde está." },
  { key: "avisar", title: "Avisarme si fichan fuera", detail: "Ficha igual, pero te avisamos. Recomendado." },
  { key: "bloquear", title: "Solo en el local", detail: "Fuera del local no le deja fichar." },
];

/** ¿Desde dónde se puede fichar? Ubicación del local y su wifi. */
function ClockPlaceSettings(props: {
  control: ClockControl;
  radius: number;
  settings: LocalSettings;
  actions: SettingsActions;
  onControl: (v: ClockControl) => void;
  onRadius: (v: number) => void;
  onDone: (m: string) => void;
  onError: (m: string) => void;
}) {
  const { control, radius, settings, actions, onControl, onRadius, onDone, onError } = props;
  const isDemo = useIsDemo();
  const [busy, setBusy] = useState<"place" | "wifi" | null>(null);
  const nothingSaved = !settings.clockHasPlace && settings.clockIps.length === 0;

  async function run(kind: "place" | "wifi", fn: () => Promise<serverActions.Result>, ok: string) {
    setBusy(kind);
    try {
      const res = await fn();
      if (res.ok) onDone(ok);
      else onError(res.error);
    } finally {
      setBusy(null);
    }
  }

  function savePlace() {
    if (!actions.saveClockPlace) return;
    if (!("geolocation" in navigator)) return onError("Este navegador no puede dar la ubicación.");
    setBusy("place");
    navigator.geolocation.getCurrentPosition(
      (p) => run("place", () => actions.saveClockPlace!({ lat: p.coords.latitude, lng: p.coords.longitude }), "Ubicación del local guardada."),
      () => {
        setBusy(null);
        onError("No se ha podido obtener la ubicación. Permítela en el navegador y vuelve a intentarlo.");
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  }

  return (
    <div className="border-t border-[#EEEBE3] py-4">
      <div className="text-[15px] font-semibold">¿Desde dónde se puede fichar?</div>
      <p className="mb-3 mt-0.5 text-[13px] text-ink-muted">Para que nadie fiche desde casa. Quien teletrabaja se marca en su ficha (Equipo).</p>
      <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Desde dónde se puede fichar">
        {CONTROL_OPTIONS.map((o) => (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={control === o.key}
            onClick={() => onControl(o.key)}
            className={`rounded-xl border p-3 text-left transition ${control === o.key ? "border-ink bg-ground ring-1 ring-ink" : "border-line-strong hover:border-ink"}`}
          >
            <span className="block text-sm font-semibold">{o.title}</span>
            <span className="block text-[12px] leading-snug text-ink-muted">{o.detail}</span>
          </button>
        ))}
      </div>

      {control !== "no" && (
        <div className="mt-4 flex flex-col gap-3 rounded-xl bg-ground p-4">
          {nothingSaved && (
            <p className="rounded-lg bg-pending-soft px-3 py-2 text-[13px] text-pending-ink">
              Guarda la ubicación o la wifi del local. Hasta entonces no se puede comprobar y se ficha como siempre.
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1 basis-56">
              <div className="text-sm font-semibold">Ubicación del local</div>
              <div className="text-[13px] text-ink-muted">{settings.clockHasPlace ? "✓ Guardada." : "Ve al local y pulsa el botón desde tu móvil."}</div>
            </div>
            <div className="flex gap-2">
              {settings.clockHasPlace && actions.clearClockPlace && (
                <button type="button" onClick={() => run("place", actions.clearClockPlace!, "Ubicación quitada.")} disabled={busy !== null} className={`${ui.btnSm} ${ui.secondary}`}>
                  Quitar
                </button>
              )}
              <button type="button" onClick={savePlace} disabled={busy !== null || isDemo} className={`${ui.btnSm} ${ui.primary}`}>
                {busy === "place" ? "Buscando…" : settings.clockHasPlace ? "Volver a guardar aquí" : "Estoy en el local: guardar"}
              </button>
            </div>
          </div>
          {settings.clockHasPlace && (
            <NumberField label="Distancia permitida" value={radius} min={50} max={2000} step={50} unit="metros" onChange={onRadius} />
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
            <div className="min-w-0 flex-1 basis-56">
              <div className="text-sm font-semibold">
                Wifi del local <span className="font-normal text-ink-muted">(opcional)</span>
              </div>
              <div className="text-[13px] text-ink-muted">Por si el GPS falla dentro del local: conectado a esta wifi, cuenta como en el local.</div>
              {settings.clockIps.length > 0 && (
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {settings.clockIps.map((ip, i) => (
                    <li key={ip} className="flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-[12px]">
                      Wifi {i + 1}
                      {actions.removeClockWifi && (
                        <button type="button" aria-label={`Quitar la wifi ${i + 1}`} onClick={() => run("wifi", () => actions.removeClockWifi!(ip), "Wifi quitada.")} className="text-ink-muted hover:text-danger-ink">
                          ✕
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {actions.addClockWifi && (
              <button type="button" onClick={() => run("wifi", actions.addClockWifi!, "Wifi del local guardada.")} disabled={busy !== null || isDemo} className={`${ui.btnSm} ${ui.secondary}`}>
                {busy === "wifi" ? "Guardando…" : "Estoy en su wifi: guardar"}
              </button>
            )}
          </div>
          <p className="text-[12px] leading-relaxed text-ink-muted">
            Solo se comprueba en el momento de fichar y no guardamos la ubicación de nadie: solo si estaba en el local o a qué distancia. Informa a tu equipo
            de que se comprueba (lo verán en su enlace).
            {isDemo && " En la demo no se puede guardar la ubicación."}
          </p>
        </div>
      )}
    </div>
  );
}
