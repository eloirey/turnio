import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { AppAvisos } from "@/components/avisos/AppAvisos";
import { AppGuide } from "@/components/guide/AppGuide";
import { HelpButton } from "@/components/guide/HelpButton";
import { SetupNotice } from "@/components/SetupNotice";
import { requireLocal } from "@/lib/data/queries";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { signOut } from "../login/actions";

const NAV = [
  { href: "/app/cuadrante", label: "Cuadrante" },
  { href: "/app/fichajes", label: "Fichajes" },
  { href: "/app/empleados", label: "Equipo" },
  { href: "/app/necesidades", label: "Necesidades" },
  { href: "/app/ajustes", label: "Ajustes" },
];

async function Shell({ children }: { children: React.ReactNode }) {
  // Misma consulta que usan las páginas: cache() hace que solo se ejecute una vez.
  const { local } = await requireLocal();
  return (
    <>
      <AppHeader localName={local.nombre} nav={NAV} signOut={signOut} extra={
          <>
            <AppAvisos />
            <HelpButton />
          </>
        } />
      {children}
      <AppGuide />
    </>
  );
}

function ShellSkeleton() {
  return (
    <div>
      <div className="h-[65px] border-b border-line bg-surface" />
      <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-8">
        <div className="h-10 w-64 animate-pulse rounded-lg bg-line" />
        <div className="mt-6 h-96 animate-pulse rounded-2xl bg-line/60" />
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured()) return <SetupNotice />;
  return (
    <div className="min-h-screen bg-ground">
      <Suspense fallback={<ShellSkeleton />}>
        <Shell>{children}</Shell>
      </Suspense>
    </div>
  );
}
