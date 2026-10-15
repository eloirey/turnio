"use server";

import { after } from "next/server";
import { AVISO_COLUMNS, toAvisos, type Aviso, type AvisoRow } from "@/lib/avisos";
import { requireLocal } from "@/lib/data/queries";
import { deliverPush, removeSubscription, saveSubscription } from "@/lib/push";
import { createClient } from "@/lib/supabase/server";

export type AvisosResult = { ok: true; items: Aviso[]; unread: number } | { ok: false };

/** Los últimos avisos del encargado (la RLS solo deja ver los de su local). */
export async function loadAvisos(): Promise<AvisosResult> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { ok: false };
  // De paso, se mandan al móvil los avisos pendientes (también los anuncios de Rotafy).
  after(() => deliverPush().catch(() => undefined));
  const [list, count] = await Promise.all([
    supabase.from("avisos").select(AVISO_COLUMNS).is("empleado_id", null).order("creado_en", { ascending: false }).limit(30),
    supabase.from("avisos").select("id", { count: "exact", head: true }).is("empleado_id", null).is("leido_en", null),
  ]);
  if (list.error) return { ok: false };
  return { ok: true, items: toAvisos((list.data ?? []) as AvisoRow[]), unread: count.count ?? 0 };
}

/** «Hecho»: el encargado da por resuelto un aviso. */
export async function markAvisoDone(id: string): Promise<{ ok: boolean }> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase.rpc("marcar_aviso_hecho", { p_id: id });
  return { ok: !error };
}

export async function readAvisos(): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("leer_avisos");
  return { ok: !error };
}

// ---------- Avisos en el móvil del encargado ----------

export async function savePushManager(subscription: unknown): Promise<{ ok: boolean }> {
  const { local } = await requireLocal();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return { ok: await saveSubscription(subscription, { localId: local.id, userId: (data?.claims?.sub as string) ?? null }) };
}

export async function removePushManager(endpoint: string): Promise<{ ok: boolean }> {
  const { local } = await requireLocal();
  return { ok: await removeSubscription(endpoint, { localId: local.id }) };
}
