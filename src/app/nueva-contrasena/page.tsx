import Link from "next/link";
import { Logo } from "@/components/Logo";
import { SetupNotice } from "@/components/SetupNotice";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { NewPasswordForm } from "./NewPasswordForm";

export const metadata = { title: "Nueva contraseña · Rotafy" };

export default function NuevaContrasenaPage() {
  if (!isSupabaseConfigured()) return <SetupNotice />;
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-ground px-4 py-12">
      <Link href="/" aria-label="Rotafy, inicio">
        <Logo size="lg" />
      </Link>
      <NewPasswordForm />
    </main>
  );
}
