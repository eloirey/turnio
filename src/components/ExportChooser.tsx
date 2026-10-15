"use client";

import { useEffect, useRef, useState } from "react";
import { ui } from "@/components/ui";
import { Portal } from "@/components/Portal";

export type FileFormat = "xlsx" | "csv";

export interface ExportModelOption<K extends string> {
  key: K;
  title: string;
  detail: string;
  /** false si ese modelo no se puede sacar en CSV (por ejemplo, varias hojas). */
  csv?: boolean;
}

interface Props<K extends string> {
  title: string;
  subtitle?: string;
  /** Pasos previos (por ejemplo, elegir el mes). Van numerados antes del modelo. */
  before?: { label: string; content: React.ReactNode };
  models: ExportModelOption<K>[];
  /** Clave para recordar la última elección en este navegador. */
  storageKey: string;
  onDownload: (model: K, format: FileFormat) => Promise<void>;
  onClose: () => void;
}

function load<K extends string>(storageKey: string, models: ExportModelOption<K>[]): { model: K; format: FileFormat } {
  try {
    const saved = JSON.parse(window.localStorage.getItem(storageKey) ?? "null") as { model?: string; format?: string } | null;
    const model = models.find((m) => m.key === saved?.model)?.key ?? models[0].key;
    const format: FileFormat = saved?.format === "csv" ? "csv" : "xlsx";
    return { model, format };
  } catch {
    return { model: models[0].key, format: "xlsx" };
  }
}

/**
 * Exportar en dos pasos claros: primero QUÉ (el modelo) y luego EN QUÉ
 * formato (Excel o CSV).
 */
export function ExportChooser<K extends string>({ title, subtitle, before, models, storageKey, onDownload, onClose }: Props<K>) {
  const [initial] = useState(() => load(storageKey, models));
  const [model, setModel] = useState<K>(initial.model);
  const [format, setFormat] = useState<FileFormat>(initial.format);
  const [busy, setBusy] = useState(false);
  const closeRef = useRef(onClose);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    dialogRef.current?.querySelector<HTMLElement>("input, select, button")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const csvAllowed = models.find((m) => m.key === model)?.csv !== false;
  const effective: FileFormat = csvAllowed ? format : "xlsx";
  const n = before ? 1 : 0;

  async function download() {
    setBusy(true);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ model, format }));
    } catch {
      // sin almacenamiento: no pasa nada
    }
    try {
      await onDownload(model, effective);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Portal>
    <div className="anim-overlay fixed inset-0 z-50 flex items-end justify-center bg-ink/30 p-0 backdrop-blur-[2px] sm:items-center sm:p-4 print:hidden" role="dialog" aria-modal="true" aria-labelledby="export-title">
      <div className="absolute inset-0" onClick={onClose} />
      <div ref={dialogRef} className="anim-sheet relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-surface shadow-2xl sm:rounded-3xl">
        <div className="border-b border-line px-6 pb-4 pt-5">
          <h2 id="export-title" className="font-display text-2xl font-bold">
            {title}
          </h2>
          {subtitle && <p className="mt-0.5 text-sm text-ink-soft">{subtitle}</p>}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {before && (
            <section className="mb-6">
              <h3 className="mb-2.5 flex items-center gap-2 text-sm font-semibold">
                <Step n={1} /> {before.label}
              </h3>
              {before.content}
            </section>
          )}

          <section>
            <h3 className="mb-2.5 flex items-center gap-2 text-sm font-semibold">
              <Step n={n + 1} /> ¿Qué quieres descargar?
            </h3>
            <div className="flex flex-col gap-2" role="radiogroup" aria-label="Qué descargar">
              {models.map((m) => (
                <label
                  key={m.key}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition ${model === m.key ? "border-ink bg-ground ring-1 ring-ink" : "border-line-strong hover:border-ink"}`}
                >
                  <input type="radio" name="modelo" checked={model === m.key} onChange={() => setModel(m.key)} className="mt-1 h-4 w-4 flex-none accent-[#1F5C46]" />
                  <span className="min-w-0">
                    <span className="block text-[15px] font-semibold">{m.title}</span>
                    <span className="block text-[13px] leading-snug text-ink-muted">{m.detail}</span>
                  </span>
                </label>
              ))}
            </div>
          </section>

          <section className="mt-6">
            <h3 className="mb-2.5 flex items-center gap-2 text-sm font-semibold">
              <Step n={n + 2} /> ¿En qué formato?
            </h3>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Formato">
              {(
                [
                  ["xlsx", "Excel", ".xlsx · con colores, listo para imprimir. Recomendado."],
                  ["csv", "CSV", ".csv · texto simple, para importar en otros programas."],
                ] as const
              ).map(([key, label, hint]) => {
                const disabled = key === "csv" && !csvAllowed;
                const selected = effective === key;
                return (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={disabled}
                    onClick={() => setFormat(key)}
                    className={`rounded-xl border p-3.5 text-left transition disabled:cursor-not-allowed disabled:opacity-45 ${selected ? "border-ink bg-ground ring-1 ring-ink" : "border-line-strong enabled:hover:border-ink"}`}
                  >
                    <span className="block text-[15px] font-semibold">{label}</span>
                    <span className="block text-[12px] leading-snug text-ink-muted">{hint}</span>
                  </button>
                );
              })}
            </div>
            {!csvAllowed && <p className="mt-2 text-[12px] text-ink-muted">«Todo junto» solo existe en Excel: un CSV no puede tener varias hojas.</p>}
          </section>
        </div>

        <div className="flex justify-end gap-2 border-t border-line bg-ground px-6 py-4">
          <button type="button" onClick={onClose} className={`${ui.btn} ${ui.secondary}`}>
            Cancelar
          </button>
          <button type="button" onClick={download} disabled={busy} className={`${ui.btn} ${ui.primary}`}>
            {busy ? "Preparando…" : `Descargar ${effective === "xlsx" ? "Excel" : "CSV"}`}
          </button>
        </div>
      </div>
    </div>
    </Portal>
  );
}

function Step({ n }: { n: number }) {
  return <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-accent text-[12px] font-bold text-white">{n}</span>;
}
