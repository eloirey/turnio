"use client";

import { useState, useTransition } from "react";
import { ui } from "@/components/ui";
import { PALETTE, roleStyle, type Role } from "@/lib/roles";
import type { SettingsActions } from "./AjustesForms";

interface DraftRole {
  key?: string;
  name: string;
  color: number;
  /** Id solo para React (las filas nuevas aún no tienen clave). */
  uid: string;
}

let uidCounter = 0;
const newUid = () => `n${++uidCounter}`;

export function RolesCard({
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
