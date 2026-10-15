
import { PALETTE } from "@/lib/roles";

/* Vistas previas de la portada: HTML, no imágenes, para que se vean nítidas en cualquier pantalla. */

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
