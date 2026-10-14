import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SetupNotice } from "@/components/SetupNotice";
import { ui } from "@/components/ui";
import { getMyLocal, requireUser } from "@/lib/data/queries";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { OnboardingForm } from "./OnboardingForm";

export const metadata = { title: "Bienvenida · Rotafy" };

async function Gate() {
  await requireUser();
  if (await getMyLocal()) redirect("/app");
  return <OnboardingForm />;
}

export default function BienvenidaPage() {
  if (!isSupabaseConfigured()) return <SetupNotice />;
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-12">
      <div className="max-w-lg text-center">
        <div className="mb-4 font-display text-2xl font-bold text-accent">rotafy</div>
        <h1 className={ui.h1}>Vamos a preparar tu local</h1>
        <p className="mt-2 text-ink-soft">Dos datos y empiezas. Tarda menos de un minuto.</p>
      </div>
      <Suspense fallback={<div className={`${ui.card} h-80 w-full max-w-lg animate-pulse`} />}>
        <Gate />
      </Suspense>
    </main>
  );
}
