"use client";

import { useEffect, useRef, useState } from "react";
import { useIsDemo } from "@/components/nav";
import { ui } from "@/components/ui";
import { groupScheduleMessage, personalScheduleMessage, personalScheduleMessageNoLink, shiftLines } from "@/lib/messages";
import type { Code, ShiftCatalog } from "@/lib/schedule/types";
import { CHANNELS, savedChannel, saveChannel, shareHref, type Channel } from "@/lib/share";
import { employeePath } from "@/lib/employee-link";

export interface NotifyEmployee {
  id: string;
  name: string;
  phone: string | null;
  token: string;
  row: Code[];
}

interface Props {
  employees: NotifyEmployee[];
  shifts: ShiftCatalog;
  monday: string;
  baseUrl: string;
  localName: string;
  gaps: number;
  onClose: () => void;
}

/**
 * Tras publicar: un botón por empleado que abre WhatsApp o Telegram con su
 * horario y su enlace ya escritos (o lo copia, para cualquier otra app).
 * El encargado solo pulsa "enviar" en cada chat.
 */
export function NotifyDialog({ employees, shifts, monday, baseUrl, localName, gaps, onClose }: Props) {
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<string | null>(null);
  const [channel, setChannel] = useState<Channel>(() => savedChannel());
  const [copied, setCopied] = useState<string | null>(null);

  function pickChannel(c: Channel) {
    setChannel(c);
    saveChannel(c);
  }

  async function copy(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      if (id !== "grupo") setSent((s) => new Set(s).add(id));
    } catch {
      setPreview(id); // si no deja copiar, se enseña para copiarlo a mano
    }
  }
  const isDemo = useIsDemo();
  const closeRef = useRef<HTMLButtonElement>(null);

  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCloseRef.current();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="notify-title"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-t-2xl bg-surface sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-line p-5">
          <div>
            <h2 id="notify-title" className={ui.h2}>
              Publicado. Ahora avisa al equipo
            </h2>
            <p className="mt-1 text-sm text-ink-soft">
              {isDemo
                ? "En la app real, cada botón abre WhatsApp o Telegram con el horario de esa persona ya escrito. En la demo te enseñamos el mensaje."
                : channel === "whatsapp"
                  ? "Cada botón abre WhatsApp con el horario de esa persona ya escrito. Solo tienes que pulsar enviar."
                  : channel === "telegram"
                    ? "Cada botón abre Telegram con el horario ya escrito: elige el chat de esa persona y pulsa enviar."
                    : "Copia el mensaje de cada persona y pégalo en la app que uséis (Signal, SMS, email…)."}
            </p>
            {!isDemo && (
              <div role="radiogroup" aria-label="Enviar por" className="mt-3 inline-flex rounded-xl bg-ground p-1 text-sm">
                {CHANNELS.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    role="radio"
                    aria-checked={channel === c.key}
                    onClick={() => pickChannel(c.key)}
                    className={`min-h-9 rounded-lg px-3 font-semibold transition ${channel === c.key ? "bg-surface text-ink shadow-sm" : "text-ink-muted hover:text-ink"}`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            )}
            {gaps > 0 && (
              <p className="mt-2 text-sm font-semibold text-danger-ink">
                Ojo: quedan {gaps} hueco{gaps > 1 ? "s" : ""} sin cubrir.
              </p>
            )}
          </div>
          <button ref={closeRef} aria-label="Cerrar" onClick={onClose} className="flex h-11 w-11 flex-none items-center justify-center rounded-[10px] border border-line-strong text-ink-soft hover:border-ink hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ink">
            ✕
          </button>
        </div>

        <ul className="flex-1 overflow-y-auto p-3">
          {employees.map((e) => {
            const link = `${baseUrl}/h/${employeePath(e.name, e.token)}`;
            const opts = { name: e.name, localName, monday, row: e.row, shifts, link };
            const msg = personalScheduleMessage(opts);
            const href = shareHref(channel, { full: msg, noLink: personalScheduleMessageNoLink(opts), link, phone: e.phone });
            const lines = shiftLines(e.row, shifts, monday);
            const isSent = sent.has(e.id);
            return (
              <li key={e.id} className="rounded-xl p-3 hover:bg-ground">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold">{e.name}</div>
                    <div className="truncate text-xs text-ink-muted">
                      {lines.length ? `${lines.length} turno${lines.length > 1 ? "s" : ""}` : "Libra toda la semana"}
                      {!e.phone && !isDemo && channel === "whatsapp" && " · sin teléfono: elegirás el chat en WhatsApp"}
                    </div>
                  </div>
                  {isDemo ? (
                    <button
                      onClick={() => {
                        setPreview((p) => (p === e.id ? null : e.id));
                        setSent((s) => new Set(s).add(e.id));
                      }}
                      className={`${ui.btnSm} flex-none ${isSent ? ui.secondary : ui.primary}`}
                    >
                      {preview === e.id ? "Ocultar" : "Ver mensaje"}
                    </button>
                  ) : href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setSent((s) => new Set(s).add(e.id))}
                      className={`${ui.btnSm} flex-none ${isSent ? ui.secondary : ui.primary}`}
                    >
                      {isSent ? "Enviado ✓" : "Enviar"}
                    </a>
                  ) : (
                    <button onClick={() => copy(e.id, msg)} className={`${ui.btnSm} flex-none ${isSent ? ui.secondary : ui.primary}`}>
                      {copied === e.id ? "Copiado ✓" : isSent ? "Copiar otra vez" : "Copiar"}
                    </button>
                  )}
                </div>
                {preview === e.id && (
                  <p className="mt-2 whitespace-pre-line rounded-2xl rounded-bl-sm bg-[#DCF3E2] px-4 py-3 text-sm leading-relaxed text-[#10251C]">{msg}</p>
                )}
              </li>
            );
          })}
        </ul>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line p-4">
          {isDemo ? (
            <span className="text-sm text-ink-muted">En la demo no se envía nada.</span>
          ) : (
            (() => {
              const group = groupScheduleMessage(localName, monday);
              const groupHref = shareHref(channel, { full: group });
              return groupHref ? (
                <a href={groupHref} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-accent underline">
                  Avisar también al grupo
                </a>
              ) : (
                <button onClick={() => copy("grupo", group)} className="text-sm font-semibold text-accent underline">
                  {copied === "grupo" ? "Mensaje del grupo copiado ✓" : "Copiar mensaje para el grupo"}
                </button>
              );
            })()
          )}
          <span className="text-sm text-ink-muted">
            {sent.size} de {employees.length} {isDemo ? "vistos" : "avisados"}
          </span>
        </div>
      </div>
    </div>
  );
}
