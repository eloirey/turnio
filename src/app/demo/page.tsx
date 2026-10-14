import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { Cuadrante } from "@/components/cuadrante/Cuadrante";
import { DEFAULT_RULES, DEFAULT_SHIFTS } from "@/lib/schedule/defaults";
import { DEMO_DEMAND, DEMO_EMPLOYEES, DEMO_ROLES } from "@/lib/schedule/demo-data";

export const metadata = { title: "Demo · Rotafy" };

const DEMO_MONDAY = "2026-10-12";
const DEMO_ABSENCES = { sara: [null, null, null, null, null, "vacaciones", "vacaciones"] };

/** Demo con datos de ejemplo: todo ocurre en el navegador y no se guarda nada. */
export default function DemoPage() {
  return (
    <div className="min-h-screen bg-ground">
      <AppHeader localName="Bar de demostración" nav={[{ href: "/demo", label: "Cuadrante (demo)" }]} />
      <div className="mx-auto max-w-[1400px] px-4 pt-5 sm:px-8 print:hidden">
        <p className="rounded-xl bg-pending-soft px-4 py-3 text-sm text-pending-ink">
          Estás en la demo: prueba a tocar casillas o a generar el cuadrante. No se guarda nada.{" "}
          <Link href="/login" className="font-semibold underline">
            Crea tu cuenta gratis
          </Link>{" "}
          para usarlo con tu equipo.
        </p>
      </div>
      <Cuadrante
        employees={DEMO_EMPLOYEES}
        roles={DEMO_ROLES}
        demand={DEMO_DEMAND}
        shifts={DEFAULT_SHIFTS}
        rules={DEFAULT_RULES}
        monday={DEMO_MONDAY}
        absences={DEMO_ABSENCES}
      />
    </div>
  );
}
