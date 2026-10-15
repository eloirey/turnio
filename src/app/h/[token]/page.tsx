import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { LogoMark } from "@/components/Logo";
import { SetupNotice } from "@/components/SetupNotice";
import { ui } from "@/components/ui";
import { addDays, DAY_LONG, DAY_SHORT, dayOfMonth, longDateLabel, weekRangeLabel } from "@/lib/dates";
import { getEmployeeView } from "@/lib/data/employee-view";
import { ABSENCE_LABELS } from "@/lib/data/mappers";
import { shiftTimes } from "@/lib/schedule/rules";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getBaseUrl } from "@/lib/url";
import { ClockCard } from "./ClockCard";
import { EmployeeAvisos } from "./EmployeeAvisos";
import { EmployeePush } from "./EmployeePush";
import { MyRecord } from "./MyRecord";
import { RequestForm } from "./RequestForm";

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { token } = await params;
  return {
    title: "Mi horario · Rotafy",
    robots: { index: false, follow: false }, // enlaces privados: que no salgan en Google
    // Al instalarla en el móvil, el icono abre SU horario (no la portada).
    manifest: `/h/${token}/manifest.webmanifest`,
    appleWebApp: { capable: true, title: "Mi horario", statusBarStyle: "default" },
  };
}

type Params = Promise<{ token: string }>;

const REQUEST_STATUS = {
  pendiente: { label: "Pendiente", cls: "bg-pending-soft text-pending-ink" },
  aceptada: { label: "Aceptada", cls: "bg-ok-soft text-accent" },
  rechazada: { label: "Rechazada", cls: "bg-danger-soft text-danger-ink" },
} as const;

async function EmployeeSchedule({ params }: { params: Params }) {
  await connection();
  const { token } = await params;
  const [view, baseUrl] = await Promise.all([getEmployeeView(token), getBaseUrl()]);
  if (!view) notFound();

  const { me, team, weeks, shifts, today, localName, requests, roleNames, absenceOn, clockEnabled, clock } = view;
  // Una casilla con una franja que ya no existe se enseña como "Turno".
  const def = (c: string) => shifts[c] ?? { label: "Turno", start: "", end: "", hours: 0 };
  const span = (c: string) => (shifts[c] ? shiftTimes(shifts[c], " – ") : "Turno");
  const nameOf = new Map(team.map((t) => [t.id, t.nombre]));
  const icsUrl = `${baseUrl}/h/${token}/calendario.ics`;
  const webcalUrl = icsUrl.replace(/^https?:/, "webcal:");
  const googleUrl = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcalUrl)}`;

  const todayWeek = weeks.find((w) => today >= w.monday && today <= addDays(w.monday, 6));
  const todayIdx = todayWeek ? Math.round((Date.parse(today) - Date.parse(todayWeek.monday)) / 86_400_000) : -1;
  const todayCode = todayWeek ? todayWeek.grid[me.id]?.[todayIdx] : undefined;
  const todayAbsence = absenceOn(today);

  const mates = (weekGrid: (typeof weeks)[number]["grid"], day: number) => {
    const code = weekGrid[me.id]?.[day];
    if (!code || code === "L") return [];
    return team.filter((t) => t.id !== me.id && weekGrid[t.id]?.[day] === code);
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-5 px-5 pb-10 pt-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-[30px] font-bold leading-tight tracking-tight">Hola, {me.nombre}</h1>
          <p className="text-sm text-ink-soft">
            {localName} · {roleNames[me.puesto] ?? me.puesto}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <EmployeeAvisos token={view.token} initial={view.avisos} />
          <LogoMark size={34} />
        </div>
      </header>

      {clockEnabled && (
        <ClockCard
          token={view.token}
          records={clock}
          now={new Date().toISOString()}
          today={today}
          todayShift={todayCode && todayCode !== "L" ? `${def(todayCode).label} · ${span(todayCode)}` : null}
          place={view.clockPlace}
        />
      )}

      <EmployeePush token={view.token} />

      {weeks.length === 0 && (
        <div className={`${ui.card} p-5 text-[15px] leading-relaxed text-ink-soft`}>
          Tu encargado aún no ha publicado el horario. Cuando lo haga, aparecerá aquí. <strong className="text-ink">Guarda este enlace</strong> en tus favoritos o
          en la pantalla de inicio del móvil.
        </div>
      )}

      {todayWeek && (
        <section aria-label="Hoy" className={`rounded-[20px] p-5 ${todayCode && todayCode !== "L" ? "bg-accent text-white" : ui.card}`}>
          <div className="text-[13px] font-medium uppercase tracking-[0.08em] opacity-90">Hoy · {longDateLabel(today)}</div>
          {todayCode && todayCode !== "L" ? (
            <>
              <div className="mt-2 font-display text-[40px] font-bold leading-none tracking-tight">{span(todayCode)}</div>
              <div className="mt-2 text-[15px]">{def(todayCode).label}</div>
              {mates(todayWeek.grid, todayIdx).length > 0 && (
                <div className="mt-3 border-t border-white/30 pt-3 text-sm">
                  Contigo: {mates(todayWeek.grid, todayIdx).map((m) => `${m.nombre} (${(roleNames[m.puesto] ?? m.puesto).toLowerCase()})`).join(", ")}
                </div>
              )}
            </>
          ) : (
            <div className="mt-2 font-display text-[30px] font-bold">{todayAbsence ? ABSENCE_LABELS[todayAbsence] : "Hoy libras"}</div>
          )}
        </section>
      )}

      {weeks.map((w) => {
        const row = w.grid[me.id] ?? [];
        const total = row.reduce((a, c) => a + (c === "L" ? 0 : def(c).hours), 0);
        const isThisWeek = w === todayWeek;
        return (
          <section key={w.id} aria-label={`Semana ${weekRangeLabel(w.monday)}`} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <h2 className={ui.h2}>{isThisWeek ? "Esta semana" : weekRangeLabel(w.monday)}</h2>
              <span className="text-sm text-ink-soft">{total} h</span>
            </div>
            {row.map((c, d) => {
              const iso = addDays(w.monday, d);
              const isToday = isThisWeek && d === todayIdx;
              const absence = absenceOn(iso);
              const withMe = mates(w.grid, d);
              const past = iso < today;
              return (
                <div
                  key={d}
                  className={`flex min-h-[60px] items-center gap-3.5 rounded-2xl px-3.5 py-3 ${c === "L" ? "border border-dashed border-[#CFCBC0]" : "border border-line bg-surface"} ${isToday ? "border-2 border-accent" : ""} ${past ? "opacity-55" : ""}`}
                >
                  <div className="flex w-11 flex-none flex-col items-center text-xs text-ink-muted">
                    <span>{DAY_SHORT[d]}</span>
                    <b className="text-lg font-semibold text-ink">{dayOfMonth(w.monday, d)}</b>
                  </div>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[15px] font-semibold">{c === "L" ? (absence ? ABSENCE_LABELS[absence] : "Libre") : span(c)}</span>
                    <span className="truncate text-[13px] text-ink-muted">
                      {c === "L" ? (absence ? "Ausencia registrada" : "Día libre") : absence ? `${def(c).label} · ⚠ ${ABSENCE_LABELS[absence]} este día` : def(c).label}
                      {withMe.length > 0 && ` · con ${withMe.map((m) => m.nombre).join(", ")}`}
                    </span>
                  </div>
                </div>
              );
            })}
          </section>
        );
      })}

      {weeks.length > 0 && (
        <section aria-label="Añadir a mi calendario" className={`${ui.card} p-5`}>
          <h2 className={`${ui.h2} mb-1`}>Llévalo en tu calendario</h2>
          <p className="mb-4 text-sm text-ink-soft">Tus turnos aparecerán solos en el calendario del móvil y se actualizarán cuando haya cambios.</p>
          <div className="grid grid-cols-2 gap-2">
            <a href={webcalUrl} className={`${ui.btnSm} ${ui.secondary} h-12`}>
              iPhone / Outlook
            </a>
            <a href={googleUrl} target="_blank" rel="noopener noreferrer" className={`${ui.btnSm} ${ui.secondary} h-12`}>
              Google Calendar
            </a>
          </div>
        </section>
      )}

      {clockEnabled && <MyRecord token={view.token} today={today} />}

      {requests.length > 0 && (
        <section aria-label="Tus solicitudes" className={`${ui.card} p-5`}>
          <h2 className={`${ui.h2} mb-3`}>Tus solicitudes</h2>
          <ul className="flex flex-col gap-2.5 text-sm">
            {requests.map((r) => {
              const w = weeks.find((x) => x.id === r.semana_id);
              const day = w ? `${DAY_LONG[r.dia]} ${dayOfMonth(w.monday, r.dia)}` : DAY_LONG[r.dia];
              return (
                <li key={r.id} className="flex items-center justify-between gap-3">
                  <span>{r.tipo === "librar" ? `Librar el ${day}` : `Cambio el ${day} con ${nameOf.get(r.con_empleado_id ?? "") ?? "un compañero"}`}</span>
                  <span className={`flex-none rounded-full px-2.5 py-0.5 text-xs font-semibold ${REQUEST_STATUS[r.estado].cls}`}>{REQUEST_STATUS[r.estado].label}</span>
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
          workDays: (w.grid[me.id] ?? []).flatMap((c, d) => (c === "L" || addDays(w.monday, d) < today ? [] : [d])),
        }))}
        mates={team.filter((t) => t.id !== me.id).map((t) => ({ id: t.id, nombre: t.nombre }))}
      />

      <section aria-label="Tu enlace" className="flex gap-3 rounded-2xl border border-line bg-surface p-4 text-[13px] leading-relaxed text-ink-soft">
        <span aria-hidden className="text-lg leading-none">
          🔒
        </span>
        <p>
          <strong className="text-ink">Este enlace es solo tuyo.</strong> No lo compartas: con él se ve tu horario y se ficha a tu nombre. Si crees que alguien más lo tiene, pide a tu encargado que te lo cambie.
        </p>
      </section>

      <footer className="mt-4 text-center text-[13px] text-ink-muted">
        Horario hecho con{" "}
        <Link href="/?ref=empleado" className="font-semibold text-accent">
          Rotafy
        </Link>
        <br />
        ¿Llevas un negocio con turnos? Pruébalo gratis.
      </footer>
    </main>
  );
}

export default function EmployeePage({ params }: { params: Params }) {
  if (!isSupabaseConfigured()) return <SetupNotice />;
  return (
    <div className="min-h-screen bg-ground">
      <Suspense
        fallback={
          <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-4 px-5 pt-6">
            <div className="h-10 w-48 animate-pulse rounded-lg bg-line" />
            <div className="h-40 animate-pulse rounded-[20px] bg-line" />
            <div className="h-80 animate-pulse rounded-2xl bg-line/60" />
          </main>
        }
      >
        <EmployeeSchedule params={params} />
      </Suspense>
    </div>
  );
}
