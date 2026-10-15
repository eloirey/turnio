import Link from "next/link";
import { Logo } from "@/components/Logo";
import { SetupNotice } from "@/components/SetupNotice";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { ResetForm } from "./ResetForm";

export const metadata = { title: "Recuperar contraseña · Rotafy" };

export default function RecuperarPage() {
  if (!isSupabaseConfigured()) return <SetupNotice />;
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-ground px-4 py-12">
      <Link href="/" aria-label="Rotafy, inicio">
        <Logo size="lg" />
      </Link>
      <ResetForm />
      <Link href="/login" className="text-sm font-semibold text-accent underline-offset-2 hover:underline">
        ← Volver a entrar
      </Link>
    </main>
  );
}
