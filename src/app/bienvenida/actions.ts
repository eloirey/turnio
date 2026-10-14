"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { demandToRows } from "@/lib/data/mappers";
import { getMyLocal, requireUser } from "@/lib/data/queries";
import { ROLES } from "@/lib/roles";
import { starterDemand } from "@/lib/schedule/templates";
import { createClient } from "@/lib/supabase/server";

export interface OnboardingState {
  error?: string;
}

const schema = z.object({
  nombre: z.string().trim().min(1, "Ponle nombre a tu local").max(120),
  puestos: z.array(z.enum(ROLES)).min(1, "Elige al menos un puesto"),
});

export async function createLocal(_prev: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const user = await requireUser();
  if (await getMyLocal()) redirect("/app");

  const parsed = schema.safeParse({ nombre: formData.get("nombre"), puestos: formData.getAll("puestos") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: local, error } = await supabase
    .from("locales")
    .insert({ owner_id: user.id, nombre: parsed.data.nombre })
    .select("id")
    .single();
  if (error || !local) return { error: "No se ha podido crear el local. Inténtalo de nuevo." };

  const rows = demandToRows(starterDemand(parsed.data.puestos)).map((r) => ({ ...r, local_id: local.id }));
  if (rows.length) {
    const { error: e2 } = await supabase.from("demanda").insert(rows);
    if (e2) return { error: "Se creó el local, pero no la plantilla de necesidades. Configúrala en Necesidades." };
  }
  redirect("/app/empleados?nuevo=1");
}
