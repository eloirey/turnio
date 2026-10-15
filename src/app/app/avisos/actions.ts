"use server";

import { AVISO_COLUMNS, toAvisos, type Aviso, type AvisoRow } from "@/lib/avisos";
import { createClient } from "@/lib/supabase/server";

export type AvisosResult = { ok: true; items: Aviso[]; unread: number } | { ok: false };

/** Los últimos avisos del encargado (la RLS solo deja ver los de su local). */
export async function loadAvisos(): Promise<AvisosResult> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { ok: false };
  const [list, count] = await Promise.all([
    supabase.from("avisos").select(AVISO_COLUMNS).is("empleado_id", null).order("creado_en", { ascending: false }).limit(30),
    supabase.from("avisos").select("id", { count: "exact", head: true }).is("empleado_id", null).is("leido_en", null),
  ]);
  if (list.error) return { ok: false };
  return { ok: true, items: toAvisos((list.data ?? []) as AvisoRow[]), unread: count.count ?? 0 };
}

export async function readAvisos(): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("leer_avisos");
  return { ok: !error };
}
