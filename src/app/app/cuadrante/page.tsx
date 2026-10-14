import { connection } from "next/server";
import { Suspense } from "react";
import { Cuadrante } from "@/components/cuadrante/Cuadrante";
import { ui } from "@/components/ui";
import { addDays, isValidISODate, mondayOf, todayInMadrid } from "@/lib/dates";
import {
  getDemand,
  getEmployees,
  getOrCreateWeek,
  getPendingRequests,
  getShifts,
  getWeekGrid,
  localToRules,
  requireLocal,
} from "@/lib/data/queries";
import { ROLE_LABELS } from "@/lib/roles";
import { getBaseUrl } from "@/lib/url";
import { acceptRequest, publishWeek, rejectRequest, saveWeek } from "./actions";

export const metadata = { title: "Cuadrante · Rotafy" };

type Search = Promise<{ semana?: string }>;

async function Content({ searchParams }: { searchParams: Search }) {
  await connection();
  const [local, { semana }] = await Promise.all([requireLocal(), searchParams]);

  const thisMonday = mondayOf(todayInMadrid());
  const monday = semana && isValidISODate(semana) ? mondayOf(semana) : thisMonday;

  const [employees, demand, shifts, { week }, baseUrl] = await Promise.all([
    getEmployees(local.id),
    getDemand(local.id),
    getShifts(local.id),
    getOrCreateWeek(local.id, monday),
    getBaseUrl(),
  ]);
  const ids = employees.map((e) => e.id);
  const [grid, requests] = await Promise.all([getWeekGrid(week.id, ids), getPendingRequests(week.id)]);

  return (
    <Cuadrante
      // La key fuerza un componente nuevo al cambiar de semana (estado limpio).
      key={week.id}
      employees={employees}
      demand={demand}
      shifts={shifts}
      rules={localToRules(local)}
      roleLabels={ROLE_LABELS}
      monday={monday}
      initialGrid={grid}
      initialStatus={week.estado}
      requests={requests}
      persistence={{
        save: saveWeek.bind(null, week.id),
        publish: publishWeek.bind(null, week.id),
        acceptRequest: acceptRequest.bind(null, week.id),
        rejectRequest,
      }}
      notify={{ baseUrl, localName: local.nombre }}
      nav={{
        prev: `/app/cuadrante?semana=${addDays(monday, -7)}`,
        next: `/app/cuadrante?semana=${addDays(monday, 7)}`,
        today: "/app/cuadrante",
        isCurrent: monday === thisMonday,
      }}
    />
  );
}

export default function CuadrantePage({ searchParams }: { searchParams: Search }) {
  return (
    <Suspense
      fallback={
        <main className="mx-auto w-full max-w-[1400px] px-4 py-7 sm:px-8">
          <div className="h-10 w-72 animate-pulse rounded-lg bg-line" />
          <div className={`${ui.card} mt-6 h-[520px] animate-pulse`} />
        </main>
      }
    >
      <Content searchParams={searchParams} />
    </Suspense>
  );
}
