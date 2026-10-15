import { connection } from "next/server";
import { Suspense } from "react";
import { ui } from "@/components/ui";
import { addDays, isValidISODate, mondayOf, todayInMadrid } from "@/lib/dates";
import { getClockPeriod, requireLocal } from "@/lib/data/queries";
import { ClockIntro } from "./ClockIntro";
import { FichajesBoard } from "./FichajesBoard";

export const metadata = { title: "Fichajes · Rotafy" };

type Search = Promise<{ semana?: string }>;

async function Content({ searchParams }: { searchParams: Search }) {
  await connection();
  const { semana } = await searchParams;
  const today = todayInMadrid();
  const thisMonday = mondayOf(today);
  const monday = semana && isValidISODate(semana) ? mondayOf(semana) : thisMonday;

  const bundle = await requireLocal();
  if (!bundle.settings.clockIn) return <ClockIntro />;
  const period = await getClockPeriod(monday, addDays(monday, 6));

  return (
    <FichajesBoard
      key={monday}
      people={[
        ...bundle.employees.map((e) => ({ id: e.id, name: e.name, role: e.role })),
        ...period.archived.map((a) => ({ ...a, archived: true })),
      ]}
      roles={bundle.roles}
      shifts={bundle.shifts}
      records={period.records}
      planned={period.planned}
      changes={period.changes}
      monday={monday}
      today={today}
      now={new Date().toISOString()}
      marginMinutes={bundle.settings.clockMarginMinutes}
      clockSince={bundle.settings.clockSince}
      nav={{
        prev: `/app/fichajes?semana=${addDays(monday, -7)}`,
        next: `/app/fichajes?semana=${addDays(monday, 7)}`,
        today: "/app/fichajes",
        isCurrent: monday === thisMonday,
      }}
    />
  );
}

export default function FichajesPage({ searchParams }: { searchParams: Search }) {
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
