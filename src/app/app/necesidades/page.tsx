import { Suspense } from "react";
import { ui } from "@/components/ui";
import { requireLocal } from "@/lib/data/queries";
import { NecesidadesEditor } from "./NecesidadesEditor";

export const metadata = { title: "Necesidades · Rotafy" };

async function Content() {
  const { demand, shifts, roles } = await requireLocal();
  return <NecesidadesEditor initialDemand={demand} initialShifts={shifts} roles={roles} />;
}

export default function NecesidadesPage() {
  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-8 sm:py-8">
      <Suspense fallback={<div className={`${ui.card} h-96 animate-pulse`} />}>
        <Content />
      </Suspense>
    </main>
  );
}
