import { Suspense } from "react";
import { ui } from "@/components/ui";
import { requireLocal } from "@/lib/data/queries";
import { AjustesForms } from "./AjustesForms";

export const metadata = { title: "Ajustes · Rotafy" };

async function Content() {
  const { local, roles, rules, settings, employees } = await requireLocal();
  const usage = Object.fromEntries(roles.map((r) => [r.key, employees.filter((e) => e.role === r.key).length]));
  return <AjustesForms localName={local.nombre} roles={roles} rules={rules} settings={settings} usage={usage} isOwner={local.es_dueno !== false} />;
}

export default function AjustesPage() {
  return (
    <main className="anim-page mx-auto w-full max-w-3xl px-4 py-6 sm:px-8 sm:py-8">
      <h1 className={`${ui.h1} mb-6`}>Ajustes</h1>
      <Suspense fallback={<div className={`${ui.card} h-96 animate-pulse`} />}>
        <Content />
      </Suspense>
    </main>
  );
}
