import Link from "next/link";
import { SetupNotice } from "@/components/SetupNotice";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Entrar · Rotafy" };

export default function LoginPage() {
  if (!isSupabaseConfigured()) return <SetupNotice />;
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-12">
      <Link href="/" className="font-display text-3xl font-bold tracking-tight text-accent">
        rotafy
      </Link>
      <LoginForm />
      <p className="max-w-md text-center text-sm text-ink-muted">
        Esta cuenta es para el encargado del local. Tu equipo no necesita registrarse: cada uno recibe su enlace personal.
      </p>
    </main>
  );
}
