"use server";

import { revalidatePath } from "next/cache";
import { demandToRows } from "@/lib/data/mappers";
import { requireLocal } from "@/lib/data/queries";
import { firstError, necesidadesSchema, type NecesidadesInput } from "@/lib/forms";
import { spanHours } from "@/lib/schedule/rules";
import type { Demand } from "@/lib/schedule/types";
import { createClient } from "@/lib/supabase/server";

export type SaveResult = { ok: true } | { ok: false; error: string };

/**
 * Guarda las franjas (lista completa, en orden) y las necesidades.
 * Primero las franjas, porque las necesidades solo pueden usar franjas que existen.
 */
export async function saveNecesidades(input: NecesidadesInput): Promise<SaveResult> {
  const { local, roles } = await requireLocal();
  const parsed = necesidadesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { demand, shifts } = parsed.data;

  const supabase = await createClient();
  const { error: shiftErr } = await supabase.rpc("guardar_franjas", {
    p_franjas: shifts.map((s) => ({
      franja: s.code,
      etiqueta: s.label,
      inicio: s.start,
      fin: s.end,
      horas: spanHours(s.start, s.end),
      cierre: s.closing,
    })),
  });
  if (shiftErr) return { ok: false, error: "No se han podido guardar las franjas." };

  // Solo se guardan necesidades de puestos y franjas que existen.
  const validRoles = new Set(roles.map((r) => r.key));
  const validSlots = new Set(shifts.map((s) => s.code));
  const rows = demandToRows(demand as Demand)
    .filter((r) => validRoles.has(r.puesto) && validSlots.has(r.franja))
    .map((r) => ({ ...r, local_id: local.id }));

  const { error: delErr } = await supabase.from("demanda").delete().eq("local_id", local.id);
  if (delErr) return { ok: false, error: "No se han podido guardar las necesidades." };
  if (rows.length) {
    const { error } = await supabase.from("demanda").insert(rows);
    if (error) return { ok: false, error: "No se han podido guardar las necesidades." };
  }

  revalidatePath("/app", "layout");
  return { ok: true };
}
