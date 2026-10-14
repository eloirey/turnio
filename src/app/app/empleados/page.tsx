import { connection } from "next/server";
import { Suspense } from "react";
import { ui } from "@/components/ui";
import { todayInMadrid } from "@/lib/dates";
import { getUpcomingAbsences, requireLocal } from "@/lib/data/queries";
import { getBaseUrl } from "@/lib/url";
import { EmpleadosManager } from "./EmpleadosManager";

export const metadata = { title: "Equipo · Rotafy" };

async function Content({ searchParams }: { searchParams: Promise<{ nuevo?: string }> }) {
  await connection();
  const today = todayInMadrid();
  const [bundle, params, absences, baseUrl] = await Promise.all([requireLocal(), searchParams, getUpcomingAbsences(today), getBaseUrl()]);
  return (
    <EmpleadosManager
      employees={bundle.employees}
      roles={bundle.roles}
      absences={absences}
      today={today}
      baseUrl={baseUrl}
      localName={bundle.local.nombre}
      firstTime={params.nuevo === "1" && bundle.employees.length === 0}
    />
  );
}

export default function EmpleadosPage({ searchParams }: { searchParams: Promise<{ nuevo?: string }> }) {
  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-8 sm:py-8">
      <Suspense fallback={<div className={`${ui.card} h-96 animate-pulse`} />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
