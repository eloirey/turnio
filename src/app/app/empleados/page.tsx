import { Suspense } from "react";
import { ui } from "@/components/ui";
import { getEmployees, requireLocal } from "@/lib/data/queries";
import { getBaseUrl } from "@/lib/url";
import { EmpleadosManager } from "./EmpleadosManager";

export const metadata = { title: "Empleados · Rotafy" };

async function Content({ searchParams }: { searchParams: Promise<{ nuevo?: string }> }) {
  const [local, params] = await Promise.all([requireLocal(), searchParams]);
  const [employees, baseUrl] = await Promise.all([getEmployees(local.id), getBaseUrl()]);
  return (
    <EmpleadosManager
      employees={employees}
      baseUrl={baseUrl}
      localName={local.nombre}
      firstTime={params.nuevo === "1" && employees.length === 0}
    />
  );
}

export default function EmpleadosPage({ searchParams }: { searchParams: Promise<{ nuevo?: string }> }) {
  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 py-7 sm:px-8">
      <Suspense fallback={<div className={`${ui.card} h-96 animate-pulse`} />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
