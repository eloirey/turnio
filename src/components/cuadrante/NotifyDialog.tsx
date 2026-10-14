"use client";

import { useEffect, useRef, useState } from "react";
import { ui } from "@/components/ui";
import { groupScheduleMessage, personalScheduleMessage, shiftLines } from "@/lib/messages";
import type { Code, ShiftCatalog } from "@/lib/schedule/types";
import { whatsappLink } from "@/lib/whatsapp";

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
 * Tras publicar: un botón por empleado que abre WhatsApp con su horario y su
 * enlace ya escritos. El encargado solo pulsa "enviar" en cada chat.
 */
export function NotifyDialog({ employees, shifts, monday, baseUrl, localName, gaps, onClose }: Props) {
  const [sent, setSent] = useState<Set<string>>(new Set());
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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
              Cada botón abre WhatsApp con el horario de esa persona ya escrito. Solo tienes que pulsar enviar.
            </p>
            {gaps > 0 && (
              <p className="mt-2 text-sm font-semibold text-danger-ink">
                Ojo: quedan {gaps} hueco{gaps > 1 ? "s" : ""} sin cubrir.
              </p>
            )}
          </div>
          <button ref={closeRef} aria-label="Cerrar" onClick={onClose} className="flex h-11 w-11 flex-none items-center justify-center rounded-[10px] border border-line-strong">
            ✕
          </button>
        </div>

        <ul className="flex-1 overflow-y-auto p-3">
          {employees.map((e) => {
            const link = `${baseUrl}/h/${e.token}`;
            const msg = personalScheduleMessage({ name: e.name, localName, monday, row: e.row, shifts, link });
            const lines = shiftLines(e.row, shifts, monday);
            const isSent = sent.has(e.id);
            return (
              <li key={e.id} className="flex items-center justify-between gap-3 rounded-xl p-3 hover:bg-ground">
                <div className="min-w-0">
                  <div className="font-semibold">{e.name}</div>
                  <div className="truncate text-xs text-ink-muted">
                    {lines.length ? `${lines.length} turno${lines.length > 1 ? "s" : ""}` : "Libra toda la semana"}
                    {!e.phone && " · sin teléfono: elegirás el chat en WhatsApp"}
                  </div>
                </div>
                <a
                  href={whatsappLink(msg, e.phone)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setSent((s) => new Set(s).add(e.id))}
                  className={`${ui.btnSm} flex-none ${isSent ? ui.secondary : ui.primary}`}
                >
                  {isSent ? "Enviado ✓" : "Enviar"}
                </a>
              </li>
            );
          })}
        </ul>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line p-4">
          <a href={whatsappLink(groupScheduleMessage(localName, monday))} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-accent underline">
            Avisar también al grupo
          </a>
          <span className="text-sm text-ink-muted">
            {sent.size} de {employees.length} avisados
          </span>
        </div>
      </div>
    </div>
  );
}
