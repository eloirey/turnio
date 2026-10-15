import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Logo } from "@/components/Logo";
import { SetupNotice } from "@/components/SetupNotice";
import { ui } from "@/components/ui";
import { getLocalBundle, requireUser } from "@/lib/data/queries";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { OnboardingForm } from "./OnboardingForm";

export const metadata = { title: "Bienvenida · Rotafy" };

async function Gate() {
  await requireUser();
  if (await getLocalBundle()) redirect("/app/cuadrante");
  return <OnboardingForm />;
}

export default function BienvenidaPage() {
  if (!isSupabaseConfigured()) return <SetupNotice />;
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-7 bg-ground px-4 py-12">
      <div className="max-w-xl text-center">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <h1 className={ui.h1}>Vamos a preparar tu negocio</h1>
        <p className="mt-2 text-[15px] text-ink-soft">Un minuto y tendrás tu primer cuadrante listo para generar.</p>
      </div>
      <Suspense fallback={<div className={`${ui.card} h-96 w-full max-w-3xl animate-pulse`} />}>
        <Gate />
      </Suspense>
    </main>
  );
}
