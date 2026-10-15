"use client";

import { useState } from "react";

interface Props {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  label: string;
}

/**
 * Número que se puede escribir o ajustar con − y +. Mientras escribes acepta
 * lo que pongas; al salir del campo lo ajusta al rango permitido y avisa.
 */
export function NumberField({ value, onChange, min, max, step = 1, unit, label }: Props) {
  const [text, setText] = useState(String(value));
  const [synced, setSynced] = useState(value);
  const [hint, setHint] = useState("");

  // Si el valor cambia desde fuera (− / + o al guardar), el texto lo sigue.
  if (synced !== value) {
    setSynced(value);
    setText(String(value));
  }

  function commit(raw: string) {
    const n = Math.round(Number(raw.replace(",", ".")));
    if (raw.trim() === "" || Number.isNaN(n)) {
      setText(String(value));
      setHint(`Escribe un número entre ${min} y ${max}.`);
      return;
    }
    const clamped = Math.min(max, Math.max(min, n));
    setHint(n > max ? `El máximo es ${max}, así que se queda en ${max}.` : n < min ? `El mínimo es ${min}, así que se queda en ${min}.` : "");
    setText(String(clamped));
    if (clamped !== value) onChange(clamped);
  }

  function bump(delta: number) {
    const n = Math.min(max, Math.max(min, value + delta));
    setHint("");
    if (n !== value) onChange(n);
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <div className="flex h-11 items-stretch overflow-hidden rounded-[10px] border border-line-strong bg-surface focus-within:border-ink focus-within:ring-2 focus-within:ring-accent/20">
          <button type="button" onClick={() => bump(-step)} disabled={value <= min} aria-label={`Menos: ${label}`} className="w-10 text-lg text-ink-soft hover:bg-ground disabled:opacity-30">
            −
          </button>
          <input
            type="text"
            inputMode="numeric"
            aria-label={label}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              const n = Number(e.target.value);
              if (e.target.value.trim() !== "" && Number.isInteger(n) && n >= min && n <= max) {
                setHint("");
                onChange(n);
              }
            }}
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && commit((e.target as HTMLInputElement).value)}
            className="w-14 border-x border-line bg-transparent text-center text-[15px] font-semibold tabular-nums outline-none"
          />
          <button type="button" onClick={() => bump(step)} disabled={value >= max} aria-label={`Más: ${label}`} className="w-10 text-lg text-ink-soft hover:bg-ground disabled:opacity-30">
            +
          </button>
        </div>
        {unit && <span className="w-14 text-sm text-ink-soft">{unit}</span>}
      </div>
      {hint && (
        <span role="status" className="max-w-[260px] text-right text-xs text-pending-ink">
          {hint}
        </span>
      )}
    </div>
  );
}
