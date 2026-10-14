import Link from "next/link";
import { Logo } from "@/components/Logo";
import { SetupNotice } from "@/components/SetupNotice";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Entrar · Rotafy" };

export default function LoginPage() {
  if (!isSupabaseConfigured()) return <SetupNotice />;
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-ground px-4 py-12">
      <Link href="/" aria-label="Rotafy, inicio">
        <Logo size="lg" />
      </Link>
      <LoginForm />
      <p className="max-w-md text-center text-sm leading-relaxed text-ink-muted">
        Esta cuenta es para quien organiza los turnos. Tu equipo no necesita registrarse: cada persona recibe su enlace personal.
      </p>
      <p className="text-center text-xs text-ink-muted">
        Al crear una cuenta aceptas la{" "}
        <Link href="/legal/privacidad" className="underline hover:text-ink">
          política de privacidad
        </Link>
        .
      </p>
    </main>
  );
}
