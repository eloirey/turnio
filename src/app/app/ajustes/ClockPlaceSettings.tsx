"use client";

import { useState } from "react";
import { useIsDemo } from "@/components/nav";
import { NumberField } from "@/components/NumberField";
import { ui } from "@/components/ui";
import type { ClockControl, LocalSettings } from "@/lib/data/mappers";
import * as serverActions from "./actions";
import type { SettingsActions } from "./AjustesForms";

export const CONTROL_OPTIONS: { key: ClockControl; title: string; detail: string }[] = [
  { key: "no", title: "Desde cualquier sitio", detail: "No se comprueba dónde está." },
  { key: "avisar", title: "Avisarme si fichan fuera", detail: "Ficha igual, pero te avisamos. Recomendado." },
  { key: "bloquear", title: "Solo en el local", detail: "Fuera del local no le deja fichar." },
];

/** ¿Desde dónde se puede fichar? Ubicación del local y su wifi. */
export function ClockPlaceSettings(props: {
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
