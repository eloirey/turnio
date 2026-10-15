"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface AcceptState {
  error?: string;
}

/** Aceptar la invitación: esta cuenta pasa a gestionar el negocio. */
export async function acceptInvite(token: string): Promise<AcceptState> {
  if (!/^[0-9a-f]{32}$/.test(token)) return { error: "Invitación no válida." };
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect(`/login?invitacion=${token}`);
  const { error } = await supabase.rpc("aceptar_invitacion", { p_token: token });
  if (error) {
    const m = error.message;
    if (m.includes("Ya gestionas")) return { error: "Esta cuenta ya gestiona un negocio. Entra con otro email para aceptar la invitación." };
    if (m.includes("caducado")) return { error: "Esta invitación ha caducado. Pide otra a quien te invitó." };
    if (m.includes("ya se ha usado")) return { error: "Esta invitación ya se ha usado. Pide otra a quien te invitó." };
    return { error: "No se ha podido aceptar la invitación." };
  }
  redirect("/app/cuadrante");
}
