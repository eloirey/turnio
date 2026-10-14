import { connection } from "next/server";
import { Suspense } from "react";
import { Cuadrante } from "@/components/cuadrante/Cuadrante";
import { ui } from "@/components/ui";
import { addDays, isValidISODate, mondayOf, todayInMadrid } from "@/lib/dates";
import { getWeekData, requireLocal, weekAbsences, weekGrid } from "@/lib/data/queries";
import { getBaseUrl } from "@/lib/url";
import { acceptRequest, copyPreviousWeek, publishWeek, rejectRequest, saveWeek } from "./actions";

export const metadata = { title: "Cuadrante · Rotafy" };

type Search = Promise<{ semana?: string }>;

async function Content({ searchParams }: { searchParams: Search }) {
  await connection();
  const { semana } = await searchParams;
  const thisMonday = mondayOf(todayInMadrid());
  const monday = semana && isValidISODate(semana) ? mondayOf(semana) : thisMonday;

  // Dos consultas en paralelo: el local (compartida con el layout) y la semana.
  const [bundle, week, baseUrl] = await Promise.all([requireLocal(), getWeekData(monday), getBaseUrl()]);
  if (!week) return null; // sin local: requireLocal ya ha redirigido

  const { local, employees, roles, demand, shifts, rules } = bundle;
  const ids = employees.map((e) => e.id);

  return (
    <Cuadrante
      // La key fuerza un componente nuevo al cambiar de semana (estado limpio).
      key={week.id}
      employees={employees}
      roles={roles}
      demand={demand}
      shifts={shifts}
      rules={rules}
      monday={monday}
      initialGrid={weekGrid(week, ids)}
      absences={weekAbsences(week, monday)}
      initialStatus={week.status}
      requests={week.requests}
      persistence={{
        save: saveWeek.bind(null, week.id),
        publish: publishWeek.bind(null, week.id),
        acceptRequest: acceptRequest.bind(null, week.id),
        rejectRequest,
        copyPrevious: copyPreviousWeek.bind(null, week.id),
      }}
      notify={{ baseUrl, localName: local.nombre }}
      nav={{
        prev: `/app/cuadrante?semana=${addDays(monday, -7)}`,
        next: `/app/cuadrante?semana=${addDays(monday, 7)}`,
        today: "/app/cuadrante",
        isCurrent: monday === thisMonday,
      }}
      onboarding={{ anyPublished: week.anyPublished, previousWeekHasShifts: week.previousWeekHasShifts }}
    />
  );
}

export default function CuadrantePage({ searchParams }: { searchParams: Search }) {
  return (
    <Suspense
      fallback={
        <main className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-8">
          <div className="h-9 w-72 animate-pulse rounded-lg bg-line" />
          <div className={`${ui.card} mt-6 h-[520px] animate-pulse`} />
        </main>
      }
    >
      <Content searchParams={searchParams} />
    </Suspense>
  );
}
