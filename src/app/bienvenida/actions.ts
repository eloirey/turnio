"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { demandToRows } from "@/lib/data/mappers";
import { getLocalBundle, requireUser } from "@/lib/data/queries";
import { makeRoleKey, PALETTE } from "@/lib/roles";
import { starterDemand } from "@/lib/schedule/templates";
import { createClient } from "@/lib/supabase/server";

export interface OnboardingState {
  error?: string;
}

const schema = z.object({
  nombre: z.string().trim().min(1, "Ponle nombre a tu local").max(120),
  puestos: z
    .array(z.string().trim().max(40, "Nombre de puesto demasiado largo"))
    .transform((l) => l.filter(Boolean))
    .pipe(z.array(z.string()).min(1, "Añade al menos un puesto").max(30)),
});

export async function createLocal(_prev: OnboardingState, formData: FormData): Promise<OnboardingState> {
  await requireUser();
  if (await getLocalBundle()) redirect("/app");

  const parsed = schema.safeParse({ nombre: formData.get("nombre"), puestos: formData.getAll("puesto") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const names = parsed.data.puestos;
  if (new Set(names.map((n) => n.toLowerCase())).size !== names.length) return { error: "Hay dos puestos con el mismo nombre." };

  const keys: string[] = [];
  const puestos = names.map((nombre, i) => {
    const clave = makeRoleKey(nombre, keys);
    keys.push(clave);
    return { clave, nombre, color: i % PALETTE.length };
  });

  const supabase = await createClient();
  // Todo en una operación atómica: local + puestos + plantilla de necesidades.
  const { error } = await supabase.rpc("crear_local", {
    p_nombre: parsed.data.nombre,
    p_puestos: puestos,
    p_demanda: demandToRows(starterDemand(keys)),
  });
  if (error) return { error: "No se ha podido crear el local. Inténtalo de nuevo." };
  redirect("/app/empleados?nuevo=1");
}
