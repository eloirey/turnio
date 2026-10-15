
import { PALETTE } from "@/lib/roles";

/* Vistas previas de la portada: HTML, no imágenes, para que se vean nítidas en cualquier pantalla. */

type Cell = { t: string; clock?: { text: string; tone: "ok" | "late" | "open" } } | null;

export function HeroPreview() {
  const rows: { name: string; role: number; cells: Cell[] }[] = [
    { name: "Marta", role: 0, cells: [{ t: "09–17", clock: { text: "✓ 08:57–17:02", tone: "ok" } }, { t: "09–17", clock: { text: "✓ 08:59–17:00", tone: "ok" } }, { t: "09–17", clock: { text: "● 08:58", tone: "open" } }, { t: "09–17" }, { t: "09–17" }, null, null] },
    { name: "Jordi", role: 1, cells: [{ t: "17–01", clock: { text: "Tarde +12′", tone: "late" } }, null, { t: "17–01" }, { t: "17–01" }, null, { t: "17–01" }, { t: "09–17" }] },
    { name: "Laura", role: 2, cells: [null, { t: "17–01", clock: { text: "✓ 16:55–01:03", tone: "ok" } }, { t: "17–01" }, null, { t: "17–01" }, { t: "13–21" }, null] },
    { name: "Aleix", role: 0, cells: [null, null, null, { t: "13–21" }, { t: "17–01" }, { t: "13–21" }, null] },
  ];
  const tone = { ok: "bg-white/80 text-accent", late: "bg-pending-soft text-pending-ink", open: "bg-ok-soft text-accent" };
  return (
    <div className="relative" aria-label="Vista previa de Rotafy: cuadrante semanal con fichajes" role="img">
      <div className="absolute -left-5 -top-8 z-10 hidden w-[260px] -rotate-2 rounded-2xl border border-line bg-surface p-3 shadow-[0_20px_40px_-18px_rgba(27,27,26,0.5)] sm:block">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[#FFD9A8] text-[#7A3E00]">
            <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9.5a6 6 0 0112 0c0 4.5 1.8 6.2 2.5 6.8H3.5c.7-.6 2.5-2.3 2.5-6.8z" />
              <path d="M10 19.5a2.2 2.2 0 004 0" />
            </svg>
          </span>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-muted">Solicitud · ahora</div>
            <div className="text-[13px] font-semibold leading-snug">Laura pide librar el viernes 16</div>
            <div className="mt-2 flex gap-1.5">
              <span className="rounded-md bg-accent px-2.5 py-1 text-[11px] font-semibold text-white">Aceptar</span>
              <span className="rounded-md border border-line-strong px-2.5 py-1 text-[11px] font-semibold">Rechazar</span>
            </div>
          </div>
        </div>
      </div>
      <div className="rounded-[28px] border border-line bg-surface/90 p-2 shadow-[0_40px_80px_-40px_rgba(27,27,26,0.45)] backdrop-blur">
        <div className="flex items-center gap-1.5 px-3 py-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#E4E1D8]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#E4E1D8]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#E4E1D8]" />
          <span className="ml-3 flex-1 truncate rounded-md bg-ground px-3 py-1 text-[11px] text-ink-muted">rotafy.es/app/cuadrante</span>
        </div>
        <div className="rounded-[20px] border border-line bg-surface p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-muted">Semana 42</div>
              <div className="font-display text-xl font-bold">12 – 18 octubre</div>
            </div>
            <span className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white">Publicar y avisar</span>
          </div>
          <div className="grid grid-cols-[44px_repeat(7,minmax(0,1fr))] gap-1 text-[10px] sm:grid-cols-[56px_repeat(7,minmax(0,1fr))] sm:text-[11px]">
            <span />
            {["L", "M", "X", "J", "V", "S", "D"].map((d) => (
              <span key={d} className="text-center font-semibold text-ink-muted">
                {d}
              </span>
            ))}
            {rows.map((r) => (
              <div key={r.name} className="contents">
                <span className="flex items-center truncate font-semibold">{r.name}</span>
                {r.cells.map((c, i) => (
                  <span
                    key={i}
                    className={`flex min-h-11 flex-col items-center justify-center gap-0.5 whitespace-nowrap rounded-md px-0.5 py-1 text-[9px] font-semibold sm:text-[11px] ${c ? "" : "border border-dashed border-[#CFCBC0] text-[#A9A59B]"}`}
                    style={c ? { backgroundColor: PALETTE[r.role].bg, color: PALETTE[r.role].fg } : undefined}
                  >
                    {c?.t ?? "—"}
                    {c?.clock && <span className={`hidden max-w-full truncate rounded px-1 leading-tight sm:block sm:text-[9px] ${tone[c.clock.tone]}`}>{c.clock.text}</span>}
                  </span>
                ))}
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:mr-36">
            <div className="flex items-center gap-2 rounded-xl bg-danger-soft px-3 py-2 text-xs text-danger-ink">
              <span className="h-2 w-2 flex-none rounded-full bg-danger" /> Sábado noche: falta 1 en barra
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-ok-soft px-3 py-2 text-xs text-accent">
              <span className="h-2 w-2 flex-none rounded-full bg-accent" /> Descansos y días libres: todo en regla
            </div>
          </div>
        </div>
      </div>

      <div className="absolute -bottom-24 -right-2 hidden w-[168px] rotate-[3deg] rounded-[28px] border-[6px] border-ink bg-surface p-3 shadow-2xl sm:block">
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-line" />
        <div className="text-[10px] text-ink-muted">Hola, Laura</div>
        <div className="mt-1 rounded-xl bg-accent p-2.5 text-white">
          <div className="text-[9px] uppercase tracking-wide opacity-80">Hoy · miércoles</div>
          <div className="font-display text-lg font-bold leading-tight">17:00 – 01:00</div>
        </div>
        <div className="mt-2 flex h-10 items-center justify-center rounded-xl bg-ink text-[11px] font-semibold text-white">Fichar entrada</div>
        <div className="mt-2 rounded-lg border border-line px-2 py-1 text-[9px]">Jue · Libre</div>
      </div>
    </div>
  );
}

export function RulesPreview() {
  const rules = [
    ["Descanso mínimo entre jornadas", "12", "horas"],
    ["Días libres por semana", "2", "días"],
    ["Cierres seguidos como máximo", "3", "noches"],
    ["Horas extra permitidas", "4", "h/semana"],
  ];
  return (
    <div className="relative" role="img" aria-label="Vista previa de las reglas del cuadrante">
      <div className="rounded-3xl border border-line bg-ground p-5 sm:p-6">
        <div className="mb-4 font-display text-lg font-bold">Reglas del cuadrante</div>
        <div className="flex flex-col gap-2.5">
          {rules.map(([t, v, u]) => (
            <div key={t} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3">
              <span className="text-[14px] font-medium">{t}</span>
              <span className="flex items-center gap-2">
                <span className="flex h-9 items-center overflow-hidden rounded-lg border border-line-strong text-sm">
                  <span className="px-2.5 text-ink-muted">−</span>
                  <span className="w-9 border-x border-line text-center font-semibold tabular-nums">{v}</span>
                  <span className="px-2.5 text-ink-muted">+</span>
                </span>
                <span className="hidden w-16 text-[13px] text-ink-muted sm:block">{u}</span>
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-xl border border-dashed border-accent/40 bg-accent-soft px-4 py-3 text-[13px] text-accent-ink">
          <strong>Nuria</strong> · prefiere librar domingo · máximo 2 cierres seguidos
        </div>
      </div>
      <div className="absolute -left-4 -top-5 hidden rotate-[-3deg] rounded-xl bg-ink px-3.5 py-2 text-[13px] font-semibold text-white shadow-xl sm:block">
        ✨ Semana generada
      </div>
    </div>
  );
}

export function ShiftsPreview() {
  const shifts = [
    { label: "Línea 12 · mañana", time: "06:00 – 14:00", color: 0 },
    { label: "Línea 12 · tarde", time: "14:00 – 22:00", color: 3 },
    { label: "Partido", time: "10:00 – 18:00", color: 4 },
    { label: "Cierre", time: "18:00 – 02:00", color: 2, closing: true },
  ];
  return (
    <div className="rounded-3xl border border-line bg-surface p-5 shadow-[0_30px_60px_-40px_rgba(27,27,26,0.4)] sm:p-6" role="img" aria-label="Vista previa de franjas personalizadas">
      <div className="mb-4 flex items-center justify-between">
        <div className="font-display text-lg font-bold">Franjas</div>
        <span className="rounded-lg border border-line-strong px-3 py-1.5 text-xs font-semibold">+ Añadir franja</span>
      </div>
      <div className="flex flex-col gap-2.5">
        {shifts.map((s) => (
          <div key={s.label} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5">
            <span className="h-8 w-1.5 flex-none rounded-full" style={{ backgroundColor: PALETTE[s.color].fg }} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{s.label}</span>
              <span className="block text-[13px] tabular-nums text-ink-muted">{s.time}</span>
            </span>
            {s.closing && <span className="rounded-full bg-pending-soft px-2 py-0.5 text-[11px] font-semibold text-pending-ink">Cierre</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ClockPreview() {
  const rows = [
    { name: "Marta", cells: ["✓ 08:57–17:02", "✓ 08:59–17:00", "● 08:58"], tone: ["ok", "ok", "open"] },
    { name: "Jordi", cells: ["Tarde +12′", "✓ 16:58–01:00", "—"], tone: ["late", "ok", "none"] },
    { name: "Laura", cells: ["Sin salida", "✓ 17:01–01:04", "● 16:56"], tone: ["bad", "ok", "open"] },
  ];
  const cls: Record<string, string> = {
    ok: "bg-white/10 text-[#8FD3B0]",
    late: "bg-[#FBEFD5]/15 text-[#F5C770]",
    open: "bg-[#8FD3B0]/20 text-[#8FD3B0]",
    bad: "bg-[#FBE6DD]/15 text-[#F4A587]",
    none: "text-white/30",
  };
  return (
    <div className="relative" role="img" aria-label="Vista previa del registro de fichajes">
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl backdrop-blur sm:p-6">
        <div className="mb-5 grid grid-cols-3 gap-2.5">
          {[
            ["Trabajando ahora", "2"],
            ["Horas esta semana", "86 h"],
            ["Por revisar", "1"],
          ].map(([l, v]) => (
            <div key={l} className="rounded-xl bg-white/[0.06] p-3">
              <div className="text-[11px] text-white/55">{l}</div>
              <div className="mt-0.5 font-display text-2xl font-bold">{v}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-[52px_repeat(3,minmax(0,1fr))] gap-1.5 text-[11px] sm:grid-cols-[64px_repeat(3,minmax(0,1fr))]">
          <span />
          {["Lun", "Mar", "Mié"].map((d) => (
            <span key={d} className="text-center font-semibold text-white/50">
              {d}
            </span>
          ))}
          {rows.map((r) => (
            <div key={r.name} className="contents">
              <span className="flex items-center font-semibold">{r.name}</span>
              {r.cells.map((c, i) => (
                <span key={i} className={`flex h-10 items-center justify-center truncate rounded-lg px-1 font-semibold tabular-nums ${cls[r.tone[i]]}`}>
                  {c}
                </span>
              ))}
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-xl bg-white/[0.06] px-4 py-3 text-[12.5px] text-white/75 sm:ml-32">
          <span className="font-semibold text-white">Corregido:</span> Laura, lun · salida 01:00 · «Olvidó fichar al cerrar»
        </div>
      </div>
      <div className="absolute -bottom-24 -left-6 hidden w-[150px] rotate-[-4deg] rounded-[26px] border-[5px] border-[#2C2C2A] bg-surface p-3 text-ink shadow-2xl sm:block">
        <div className="text-[10px] text-ink-muted">Trabajando desde las 08:58</div>
        <div className="mt-1 font-display text-2xl font-bold tabular-nums">3:42:10</div>
        <div className="mt-2 flex h-10 items-center justify-center rounded-xl bg-danger text-[11px] font-semibold text-white">Fichar salida</div>
      </div>
    </div>
  );
}

export function WhatsAppPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[400px]" role="img" aria-label="Vista previa del mensaje de WhatsApp con el horario">
      <div className="rounded-[34px] border-[7px] border-ink bg-[#EFE7DD] p-4 shadow-[0_40px_80px_-40px_rgba(27,27,26,0.55)]">
        <div className="mb-3 flex items-center gap-2.5 rounded-2xl bg-surface/80 px-3 py-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">BC</span>
          <span className="text-sm font-semibold">Bar Central</span>
        </div>
        <div className="ml-auto max-w-[92%] rounded-2xl rounded-tr-sm bg-[#D9FDD3] px-3.5 py-2.5 text-[13px] leading-relaxed text-[#111B21] shadow-sm">
          Hola Laura, ya está tu horario de Bar Central (12–18 oct):
          <br />
          <br />
          Mar 13 · Noche 17:00–01:00
          <br />
          Mié 14 · Noche 17:00–01:00
          <br />
          Vie 16 · Noche 17:00–01:00
          <br />
          Sáb 17 · Tarde 13:00–21:00
          <br />
          <br />
          Lo tienes siempre aquí: <span className="text-[#00639A] underline">rotafy.es/h/laura-…</span>
          <br />
          <span className="text-[#54656F]">(Es tu enlace personal: no lo compartas.)</span>
          <span className="mt-1 block text-right text-[11px] text-[#54656F]">19:42 ✓✓</span>
        </div>
      </div>
      <div className="absolute -right-3 top-24 hidden rotate-[4deg] rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[12px] shadow-xl sm:block">
        <div className="font-semibold">📅 Añadido al calendario</div>
        <div className="text-ink-muted">Se actualiza solo</div>
      </div>
    </div>
  );
}
