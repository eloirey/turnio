"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { demandToRows } from "@/lib/data/mappers";
import { requireLocal } from "@/lib/data/queries";
import type { Demand } from "@/lib/schedule/types";
import { createClient } from "@/lib/supabase/server";

const count = z.number().int().min(0).max(50);
const byRole = z.record(z.string().regex(/^[a-z0-9-]{1,40}$/), count);
const day = z.object({ M: byRole.optional(), T: byRole.optional(), N: byRole.optional() });
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora no válida (usa HH:MM)");
const shift = z.object({
  start: time,
  end: time,
  hours: z.number().min(0.5, "Cada franja debe durar al menos media hora").max(16, "Una franja no puede pasar de 16 horas"),
});

const schema = z.object({
  demand: z.array(day).length(7),
  shifts: z.object({ M: shift, T: shift, N: shift }),
});

export type NecesidadesInput = z.input<typeof schema>;

export async function saveNecesidades(input: NecesidadesInput): Promise<{ ok: boolean; error?: string }> {
  const { local, roles } = await requireLocal();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { demand, shifts } = parsed.data;

  // Solo se guardan necesidades de puestos que existen en este local.
  const valid = new Set(roles.map((r) => r.key));
  const rows = demandToRows(demand as Demand)
    .filter((r) => valid.has(r.puesto))
    .map((r) => ({ ...r, local_id: local.id }));

  const supabase = await createClient();
  const { error: delErr } = await supabase.from("demanda").delete().eq("local_id", local.id);
  if (delErr) return { ok: false, error: "No se han podido guardar las necesidades." };
  if (rows.length) {
    const { error } = await supabase.from("demanda").insert(rows);
    if (error) return { ok: false, error: "No se han podido guardar las necesidades." };
  }

  const labels = { M: "Mañana", T: "Tarde", N: "Noche" } as const;
  const { error: shiftErr } = await supabase.from("franjas").upsert(
    (["M", "T", "N"] as const).map((f) => ({
      local_id: local.id,
      franja: f,
      etiqueta: labels[f],
      inicio: shifts[f].start,
      fin: shifts[f].end,
      horas: shifts[f].hours,
    })),
  );
  if (shiftErr) return { ok: false, error: "No se han podido guardar los horarios de las franjas." };

  revalidatePath("/app", "layout");
  return { ok: true };
}
