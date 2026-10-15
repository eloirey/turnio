"use client";

import { useState, useTransition } from "react";
import { ui } from "@/components/ui";
import * as serverActions from "./actions";

export function DangerCard({ localName, remove, onError }: { localName: string; remove: (name: string) => Promise<serverActions.Result>; onError: (m: string) => void }) {
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
