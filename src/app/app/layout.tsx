import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { SetupNotice } from "@/components/SetupNotice";
import { requireLocal } from "@/lib/data/queries";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { signOut } from "../login/actions";

const NAV = [
  { href: "/app/cuadrante", label: "Cuadrante" },
  { href: "/app/empleados", label: "Empleados" },
  { href: "/app/necesidades", label: "Necesidades" },
];

async function Shell({ children }: { children: React.ReactNode }) {
  const local = await requireLocal();
  return (
    <>
      <AppHeader localName={local.nombre} nav={NAV} signOut={signOut} />
      {children}
    </>
  );
}

function ShellSkeleton() {
  return (
    <div>
      <div className="h-[73px] border-b border-line bg-surface" />
      <div className="mx-auto max-w-[1400px] px-8 py-8">
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
