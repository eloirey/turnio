import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/Logo";
import { SetupNotice } from "@/components/SetupNotice";
import { ui } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Entrar · Rotafy" };

type Search = Promise<{ error?: string }>;

/** Google aparece cuando está configurado en Supabase (variable NEXT_PUBLIC_AUTH_GOOGLE=1). */
const googleEnabled = process.env.NEXT_PUBLIC_AUTH_GOOGLE === "1";

async function Form({ searchParams }: { searchParams: Search }) {
  const { error } = await searchParams;
  return <LoginForm googleEnabled={googleEnabled} initialError={error} />;
}

export default function LoginPage({ searchParams }: { searchParams: Search }) {
  if (!isSupabaseConfigured()) return <SetupNotice />;
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-ground px-4 py-12">
      <Link href="/" aria-label="Rotafy, inicio">
        <Logo size="lg" />
      </Link>
      <Suspense fallback={<div className={`${ui.card} h-[380px] w-full max-w-md animate-pulse`} />}>
        <Form searchParams={searchParams} />
      </Suspense>
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
