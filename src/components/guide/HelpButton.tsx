"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ui } from "@/components/ui";
import { startGuide } from "./AppGuide";
import { helpFor } from "./help-content";

const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;

/**
 * Botón «Ayuda» de la cabecera: abre un panel con las dudas de la pantalla en
 * la que estás y, abajo, la guía paso a paso completa.
 */
export function HelpButton() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const help = helpFor(pathname);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`flex min-h-10 items-center gap-1.5 rounded-lg px-3 font-semibold ${open ? "bg-accent-soft text-accent-ink" : "text-accent hover:bg-accent-soft"}`}
      >
        <span aria-hidden className="flex h-5 w-5 items-center justify-center rounded-full border-[1.5px] border-current text-[11px] leading-none">
          ?
        </span>
        Ayuda
      </button>

      {/* Fuera de la cabecera: su desenfoque haría que el panel quedara atrapado dentro. */}
      {open &&
        createPortal(
        <div className="fixed inset-0 z-50 print:hidden" role="dialog" aria-modal="true" aria-labelledby="help-title">
          <div className="anim-overlay absolute inset-0 bg-ink/30 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
          <div className="anim-drawer absolute inset-x-0 bottom-0 flex max-h-[88vh] flex-col overflow-hidden rounded-t-3xl bg-surface shadow-2xl sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[440px] sm:rounded-none sm:rounded-l-3xl">
            <div className="flex items-start justify-between gap-3 border-b border-line px-6 pb-4 pt-5">
              <div>
                <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Ayuda</div>
                <h2 id="help-title" className="font-display text-2xl font-bold">
                  {help?.title ?? "Rotafy"}
                </h2>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar la ayuda"
                className="flex h-10 w-10 flex-none items-center justify-center rounded-full text-lg text-ink-muted hover:bg-ground hover:text-ink"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {help ? (
                <>
                  <p className="text-[15px] leading-relaxed text-ink-soft">{help.intro}</p>
                  <div className="mt-5 divide-y divide-line rounded-2xl border border-line">
                    {help.topics.map((t, i) => (
                      <details key={t.q} className="group px-4" open={i === 0}>
                        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 py-3 text-[15px] font-semibold">
                          {t.q}
                          <span aria-hidden className="flex h-6 w-6 flex-none items-center justify-center rounded-full border border-line-strong text-sm text-ink-muted transition group-open:rotate-45">
                            +
                          </span>
                        </summary>
                        <p className="pb-4 text-[14px] leading-relaxed text-ink-soft">{t.a}</p>
                      </details>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-[15px] text-ink-soft">Abre cualquier pantalla de la app y aquí verás las dudas más habituales sobre ella.</p>
              )}
              {SUPPORT_EMAIL && (
                <p className="mt-5 text-[13px] text-ink-muted">
                  ¿No encuentras la respuesta? Escríbenos a{" "}
                  <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-accent underline-offset-2 hover:underline">
                    {SUPPORT_EMAIL}
                  </a>
                  .
                </p>
              )}
            </div>

            <div className="border-t border-line bg-ground px-6 py-4">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  startGuide((href) => router.push(href), pathname);
                }}
                className={`${ui.btn} ${ui.primary} w-full`}
              >
                Ver la guía paso a paso completa
              </button>
              <p className="mt-2 text-center text-[12px] text-ink-muted">Te acompaña por todas las pantallas, de crear el equipo a fichar.</p>
            </div>
          </div>
        </div>,
          document.body,
        )}
    </>
  );
}
