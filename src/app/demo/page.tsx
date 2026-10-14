import { AppHeader } from "@/components/AppHeader";
import { Cuadrante } from "@/components/cuadrante/Cuadrante";
import { DEMO_DEMAND, DEMO_EMPLOYEES, ROLE_LABELS } from "@/lib/schedule/demo-data";

export const metadata = { title: "Demo · Turnio" };

/** Demo con datos de ejemplo. Cuando conectemos Supabase, esto leerá los datos del local. */
export default function DemoPage() {
  return (
    <div className="min-h-screen bg-ground">
      <AppHeader localName="Bar de demostración" />
      <Cuadrante employees={DEMO_EMPLOYEES} demand={DEMO_DEMAND} roleLabels={ROLE_LABELS} weekLabel="Semana 42" />
    </div>
  );
}
