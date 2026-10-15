import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Logo } from "@/components/Logo";
import { SetupNotice } from "@/components/SetupNotice";
import { ui } from "@/components/ui";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { AcceptForm } from "./AcceptForm";

export const metadata = { title: "Invitación · Rotafy", robots: { index: false, follow: false } };

type Params = Promise<{ token: string }>;

/** ¿Ya pasó la fecha? (se renderiza siempre al recibir la petición) */
function expired(iso: string): boolean {
  return Date.parse(iso) < new Date().getTime();
}

async function Invitation({ params }: { params: Params }) {
  await connection();
  const { token } = await params;
  const valid = /^[0-9a-f]{32}$/.test(token);
  const db = createAdminClient();
  const { data: inv } = valid
    ? await db.from("invitaciones").select("local_id, expira_en, usada_por, locales(nombre)").eq("token", token).maybeSingle()
    : { data: null };
  const localName = (inv?.locales as { nombre?: string } | null)?.nombre ?? "";

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;

  let body: React.ReactNode;
  if (!inv) {
    body = <p className="text-ink-soft">Esta invitación no existe. Comprueba el enlace o pide otro a quien te invitó.</p>;
  } else if (inv.usada_por && inv.usada_por === userId) {
    body = (
      <>
        <p className="text-ink-soft">Ya eres encargado de «{localName}».</p>
        <Link href="/app/cuadrante" className={`${ui.btn} ${ui.primary} h-12 w-full text-base`}>
          Ir al cuadrante
        </Link>
      </>
    );
  } else if (inv.usada_por) {
    body = <p className="text-ink-soft">Esta invitación ya se ha usado. Pide otra a quien te invitó.</p>;
  } else if (expired(inv.expira_en as string)) {
    body = <p className="text-ink-soft">Esta invitación ha caducado (duran 7 días). Pide otra a quien te invitó.</p>;
  } else if (!userId) {
    body = (
      <>
        <p className="text-ink-soft">Entra con tu cuenta o crea una nueva (gratis) para aceptar. Tu equipo no necesita cuenta: esto es solo para quien organiza los turnos.</p>
        <Link href={`/login?invitacion=${token}`} className={`${ui.btn} ${ui.primary} h-12 w-full text-base`}>
          Entrar o crear cuenta
        </Link>
      </>
    );
  } else {
    body = (
      <>
        <p className="text-ink-soft">
          Podrás hacer el cuadrante, gestionar el equipo, revisar fichajes y recibir los avisos, igual que quien te invitó.
        </p>
        <AcceptForm token={token} />
        <p className="text-center text-[13px] text-ink-muted">Entrarás como {(claims?.claims?.email as string) ?? "tu cuenta actual"}.</p>
      </>
    );
  }

  return (
    <div className={`${ui.card} flex w-full max-w-md flex-col gap-4 p-7`}>
      <div>
        <div className="text-[13px] font-semibold uppercase tracking-[0.08em] text-accent">Invitación</div>
        <h1 className="mt-1 font-display text-2xl font-bold leading-tight">{localName ? `Gestiona los turnos de «${localName}»` : "Invitación a Rotafy"}</h1>
      </div>
      {body}
    </div>
  );
}

export default function InvitationPage({ params }: { params: Params }) {
  if (!isSupabaseConfigured()) return <SetupNotice />;
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-ground px-4 py-12">
      <Link href="/" aria-label="Rotafy, inicio">
        <Logo size="lg" />
      </Link>
      <Suspense fallback={<div className={`${ui.card} h-64 w-full max-w-md animate-pulse`} />}>
        <Invitation params={params} />
      </Suspense>
    </main>
  );
}
