import { AppHeader } from "@/components/AppHeader";
import { Cuadrante } from "@/components/cuadrante/Cuadrante";
import { DEFAULT_RULES, DEFAULT_SHIFTS } from "@/lib/schedule/defaults";
import { DEMO_DEMAND, DEMO_EMPLOYEES, ROLE_LABELS } from "@/lib/schedule/demo-data";

export const metadata = { title: "Demo · Rotafy" };

const DEMO_MONDAY = "2026-10-12";

/** Demo con datos de ejemplo: todo ocurre en el navegador y no se guarda nada. */
export default function DemoPage() {
  return (
    <div className="min-h-screen bg-ground">
      <AppHeader localName="Bar de demostración" nav={[{ href: "/demo", label: "Cuadrante (demo)" }]} />
      <div className="mx-auto max-w-[1400px] px-4 pt-5 sm:px-8 print:hidden">
        <p className="rounded-[10px] bg-pending-soft px-4 py-3 text-sm text-pending-ink">
          Estás en la demo: los cambios no se guardan. <a href="/login" className="font-semibold underline">Crea tu cuenta</a> para usarlo con tu equipo.
        </p>
      </div>
      <Cuadrante
        employees={DEMO_EMPLOYEES}
        demand={DEMO_DEMAND}
        shifts={DEFAULT_SHIFTS}
        rules={DEFAULT_RULES}
        roleLabels={ROLE_LABELS}
        monday={DEMO_MONDAY}
      />
    </div>
  );
}
