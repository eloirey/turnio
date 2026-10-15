"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ui } from "./ui";
import { Portal } from "./Portal";

// ---------- Avisos breves (toasts), con acción opcional ("Deshacer") ----------

export interface ToastData {
  message: string;
  action?: { label: string; onClick: () => void };
  tone?: "info" | "error";
}

export function useToast(duration = 5000) {
  const [toast, setToast] = useState<ToastData | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (t: ToastData | string) => {
      if (timer.current) clearTimeout(timer.current);
      setToast(typeof t === "string" ? { message: t } : t);
      timer.current = setTimeout(() => setToast(null), duration);
    },
    [duration],
  );
  const hide = useCallback(() => setToast(null), []);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const view = toast ? (
    <Portal>
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex justify-center px-4 print:hidden">
      <div
        role="status"
        className={`anim-toast pointer-events-auto flex max-w-xl items-center gap-4 rounded-xl px-4 py-3 text-[15px] shadow-lg ${toast.tone === "error" ? "bg-danger text-white" : "bg-ink text-white"}`}
      >
        <span>{toast.message}</span>
        {toast.action && (
          <button
            onClick={() => {
              toast.action!.onClick();
              hide();
            }}
            className="min-h-9 flex-none rounded-lg px-2 font-semibold text-[#8FD3B0] underline-offset-2 hover:underline"
          >
            {toast.action.label}
          </button>
        )}
      </div>
    </div>
    </Portal>
  ) : null;

  return { show, hide, view };
}

// ---------- Confirmaciones con diálogo propio (sustituyen a window.confirm) ----------

interface ConfirmOptions {
  title: string;
  body?: string;
  confirmLabel?: string;
  danger?: boolean;
}

export function useConfirm() {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  const confirm = useCallback(
    (opts: ConfirmOptions) => new Promise<boolean>((resolve) => setState({ ...opts, resolve })),
    [],
  );

  const close = useCallback(
    (ok: boolean) => {
      state?.resolve(ok);
      setState(null);
    },
    [state],
  );

  useEffect(() => {
    if (!state) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, close]);

  const view = state ? (
    <Portal>
    <div className="anim-overlay fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-6" onClick={() => close(false)}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onClick={(e) => e.stopPropagation()}
        className="anim-sheet w-full max-w-md rounded-t-2xl bg-surface p-6 shadow-xl sm:rounded-2xl"
      >
        <h2 id="confirm-title" className={ui.h2}>
          {state.title}
        </h2>
        {state.body && <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{state.body}</p>}
        <div className="mt-6 flex justify-end gap-2.5">
          <button onClick={() => close(false)} className={`${ui.btn} ${ui.secondary}`}>
            Cancelar
          </button>
          <button
            ref={confirmRef}
            onClick={() => close(true)}
            className={`${ui.btn} ${state.danger ? "bg-danger text-white hover:bg-danger-ink" : ui.primary}`}
          >
            {state.confirmLabel ?? "Confirmar"}
          </button>
        </div>
      </div>
    </div>
    </Portal>
  ) : null;

  return { confirm, view };
}
