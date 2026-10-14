import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { SetupNotice } from "@/components/SetupNotice";
import { ui } from "@/components/ui";
import { getEmployeeView } from "@/lib/data/employee-view";
import { addDays, DAY_LONG, DAY_SHORT, dayOfMonth, longDateLabel, weekRangeLabel } from "@/lib/dates";
import { ROLE_LABELS } from "@/lib/roles";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { RequestForm } from "./RequestForm";

export const metadata: Metadata = {
  title: "Mi horario · Turnio",
  robots: { index: false, follow: false }, // enlaces privados: que no salgan en Google
};

type Params = Promise<{ token: string }>;

const REQUEST_STATUS = {
  pendiente: { label: "Pendiente", cls: "bg-pending-soft text-pending-ink" },
  aceptada: { label: "Aceptada", cls: "bg-ok-soft text-accent" },
  rechazada: { label: "Rechazada", cls: "bg-danger-soft text-danger-ink" },
} as const;

async function EmployeeSchedule({ params }: { params: Params }) {
  await connection();
  const { token } = await params;
  const view = await getEmployeeView(token);
  if (!view) notFound();

  const { me, team, weeks, shifts, today, localName, requests } = view;
  const nameOf = new Map(team.map((t) => [t.id, t.nombre]));

  // ¿Hoy cae en alguna semana publicada?
  const todayWeek = weeks.find((w) => today >= w.monday && today <= addDays(w.monday, 6));
  const todayIdx = todayWeek ? Math.round((Date.parse(today) - Date.parse(todayWeek.monday)) / 86_400_000) : -1;
  const todayCode = todayWeek ? todayWeek.grid[me.id]?.[todayIdx] : undefined;

  const mates = (weekGrid: (typeof weeks)[number]["grid"], day: number) => {
    const code = weekGrid[me.id]?.[day];
    if (!code || code === "L") return [];
    return team.filter((t) => t.id !== me.id && weekGrid[t.id]?.[day] === code);
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-5 bg-ground px-5 pb-10 pt-7">
      <header>
        <div className="font-display text-lg font-bold text-accent">turnio</div>
        <h1 className="mt-1.5 font-display text-[30px] font-bold tracking-tight">Hola, {me.nombre}</h1>
        <p className="text-sm text-ink-soft">
          {localName} · {ROLE_LABELS[me.puesto] ?? me.puesto}
        </p>
      </header>

      {weeks.length === 0 && (
        <div className={`${ui.card} p-5 text-[15px] text-ink-soft`}>
          Tu encargado aún no ha publicado el horario. Cuando lo haga, aparecerá aquí. Guarda este enlace en tu móvil.
        </div>
      )}

      {todayWeek && (
        <section aria-label="Hoy" className={`rounded-[18px] p-5 ${todayCode && todayCode !== "L" ? "bg-accent text-white" : `${ui.card}`}`}>
          <div className="text-[13px] uppercase tracking-[0.08em] opacity-90">Hoy · {longDateLabel(today)}</div>
          {todayCode && todayCode !== "L" ? (
            <>
              <div className="mt-2 font-display text-[38px] font-bold leading-none tracking-tight">
                {shifts[todayCode].start} – {shifts[todayCode].end}
              </div>
              <div className="mt-2 text-[15px]">{shifts[todayCode].label}</div>
              {mates(todayWeek.grid, todayIdx).length > 0 && (
                <div className="mt-3 border-t border-white/30 pt-3 text-sm">
                  Contigo:{" "}
                  {mates(todayWeek.grid, todayIdx)
                    .map((m) => `${m.nombre} (${(ROLE_LABELS[m.puesto] ?? m.puesto).toLowerCase()})`)
                    .join(", ")}
                </div>
              )}
            </>
          ) : (
            <div className="mt-2 font-display text-[30px] font-bold">Hoy libras</div>
          )}
        </section>
      )}

      {weeks.map((w, wi) => {
        const row = w.grid[me.id] ?? [];
        const total = row.reduce((a, c) => a + (c === "L" ? 0 : shifts[c].hours), 0);
        return (
          <section key={w.id} aria-label={`Semana ${weekRangeLabel(w.monday)}`} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <h2 className={ui.h2}>{wi === 0 && w === todayWeek ? "Esta semana" : weekRangeLabel(w.monday)}</h2>
              <span className="text-sm text-ink-soft">{total} h</span>
            </div>
            {row.map((c, d) => {
              const isToday = w === todayWeek && d === todayIdx;
              const withMe = mates(w.grid, d);
              return (
                <div
                  key={d}
                  className={`flex min-h-14 items-center gap-3.5 rounded-xl px-3.5 py-3 ${c === "L" ? "border border-dashed border-[#CFCBC0]" : "border border-line bg-surface"} ${isToday ? "border-2 border-accent" : ""}`}
                >
                  <div className="flex w-11 flex-none flex-col items-center text-xs text-ink-muted">
                    <span>{DAY_SHORT[d]}</span>
                    <b className="text-lg font-semibold text-ink">{dayOfMonth(w.monday, d)}</b>
                  </div>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[15px] font-semibold">{c === "L" ? "Libre" : `${shifts[c].start} – ${shifts[c].end}`}</span>
                    <span className="truncate text-[13px] text-ink-muted">
                      {c === "L" ? "Día libre" : shifts[c].label}
                      {withMe.length > 0 && ` · con ${withMe.map((m) => m.nombre).join(", ")}`}
                    </span>
                  </div>
                </div>
              );
            })}
          </section>
        );
      })}

      {requests.length > 0 && (
        <section aria-label="Tus solicitudes" className={`${ui.card} p-5`}>
          <h2 className={`${ui.h2} mb-3`}>Tus solicitudes</h2>
          <ul className="flex flex-col gap-2.5 text-sm">
            {requests.map((r) => {
              const w = weeks.find((x) => x.id === r.semana_id);
              const day = w ? `${DAY_LONG[r.dia]} ${dayOfMonth(w.monday, r.dia)}` : DAY_LONG[r.dia];
              return (
                <li key={r.id} className="flex items-center justify-between gap-3">
                  <span>
                    {r.tipo === "librar" ? `Librar el ${day}` : `Cambio el ${day} con ${nameOf.get(r.con_empleado_id ?? "") ?? "un compañero"}`}
                  </span>
                  <span className={`flex-none rounded-full px-2.5 py-0.5 text-xs font-semibold ${REQUEST_STATUS[r.estado].cls}`}>
                    {REQUEST_STATUS[r.estado].label}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <RequestForm
        token={view.token}
        weeks={weeks.map((w) => ({
          id: w.id,
          monday: w.monday,
          label: weekRangeLabel(w.monday),
          workDays: (w.grid[me.id] ?? []).flatMap((c, d) => (c === "L" ? [] : [d])),
        }))}
        mates={team.filter((t) => t.id !== me.id).map((t) => ({ id: t.id, nombre: t.nombre }))}
      />
    </main>
  );
}

export default function EmployeePage({ params }: { params: Params }) {
  if (!isSupabaseConfigured()) return <SetupNotice />;
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-4 px-5 pt-7">
          <div className="h-10 w-48 animate-pulse rounded-lg bg-line" />
          <div className="h-40 animate-pulse rounded-[18px] bg-line" />
          <div className="h-80 animate-pulse rounded-xl bg-line/60" />
        </main>
      }
    >
      <EmployeeSchedule params={params} />
    </Suspense>
  );
}
