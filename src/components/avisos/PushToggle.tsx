"use client";

import { useEffect, useState } from "react";

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

type State = "loading" | "unavailable" | "ios-install" | "off" | "on" | "denied";

interface Props {
  save: (subscription: unknown) => Promise<{ ok: boolean }>;
  remove: (endpoint: string) => Promise<{ ok: boolean }>;
  /** «este móvil» / «este dispositivo» */
  device?: string;
  compact?: boolean;
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = () => window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration("/");
  return (await reg?.pushManager.getSubscription()) ?? null;
}

/**
 * Activar los avisos en el móvil. En Android funciona desde el navegador; en
 * iPhone, Apple solo lo permite si la página se añade a la pantalla de inicio.
 */
export function PushToggle({ save, remove, device = "este móvil", compact = false }: Props) {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancel = false;
    (async () => {
      let next: State;
      if (!VAPID) next = "unavailable";
      else if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) next = isIos() && !isStandalone() ? "ios-install" : "unavailable";
      else if (Notification.permission === "denied") next = "denied";
      else next = (await currentSubscription().catch(() => null)) && Notification.permission === "granted" ? "on" : "off";
      if (!cancel) setState(next);
    })();
    return () => {
      cancel = true;
    };
  }, []);

  async function enable() {
    setBusy(true);
    setError("");
    try {
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID!) }));
      const res = await save(sub.toJSON());
      if (!res.ok) throw new Error("save");
      setState("on");
    } catch {
      setError("No se han podido activar. Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const sub = await currentSubscription();
      if (sub) {
        await remove(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading" || state === "unavailable") return null;

  // Si los bloqueó, basta una línea discreta: no hace falta una tarjeta entera.
  const box = compact || state === "denied" ? "px-1 text-[13px]" : "rounded-2xl border border-line bg-surface p-4 text-sm";
  return (
    <div className={box}>
      {state === "on" && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-semibold text-accent">🔔 Avisos activados en {device}</span>
          <button type="button" onClick={disable} disabled={busy} className="text-[13px] font-semibold text-ink-muted underline underline-offset-2 hover:text-ink">
            Desactivar
          </button>
        </div>
      )}
      {state === "off" && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="min-w-0 flex-1 text-ink-soft">
            {compact ? "Recibe estos avisos en " + device + "." : "Recibe un aviso en el móvil cuando cambie tu horario o te respondan."}
          </span>
          <button
            type="button"
            onClick={enable}
            disabled={busy}
            className="inline-flex min-h-10 flex-none items-center rounded-lg bg-accent px-3.5 text-sm font-semibold text-white hover:bg-accent-ink disabled:opacity-60"
          >
            {busy ? "Activando…" : "Activar avisos"}
          </button>
        </div>
      )}
      {state === "denied" && (
        <p className="text-ink-muted">
          🔕 Avisos bloqueados en este navegador. Si los quieres, permítelos en sus ajustes (el candado junto a la dirección).
        </p>
      )}
      {state === "ios-install" && (
        <div className="text-ink-soft">
          <strong className="text-ink">¿Quieres avisos en tu iPhone?</strong> Apple solo los permite si añades esta página a la pantalla de inicio:
          <ol className="mt-1.5 list-decimal space-y-0.5 pl-5">
            <li>
              Pulsa <strong className="text-ink">Compartir</strong> (el cuadrado con la flecha hacia arriba).
            </li>
            <li>
              Elige <strong className="text-ink">Añadir a pantalla de inicio</strong>.
            </li>
            <li>Abre Rotafy desde ese icono y pulsa «Activar avisos».</li>
          </ol>
        </div>
      )}
      {error && <p className="mt-2 text-danger-ink">{error}</p>}
    </div>
  );
}
