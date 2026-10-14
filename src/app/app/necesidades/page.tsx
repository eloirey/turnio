import { Suspense } from "react";
import { ui } from "@/components/ui";
import { getDemand, getShifts, localToRules, requireLocal } from "@/lib/data/queries";
import { NecesidadesEditor } from "./NecesidadesEditor";

export const metadata = { title: "Necesidades · Turnio" };

async function Content() {
  const local = await requireLocal();
  const [demand, shifts] = await Promise.all([getDemand(local.id), getShifts(local.id)]);
  return <NecesidadesEditor initialDemand={demand} initialRules={localToRules(local)} initialShifts={shifts} />;
}

export default function NecesidadesPage() {
  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 py-7 sm:px-8">
      <Suspense fallback={<div className={`${ui.card} h-96 animate-pulse`} />}>
        <Content />
      </Suspense>
    </main>
  );
}
