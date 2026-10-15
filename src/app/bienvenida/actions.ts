"use server";

import { redirect } from "next/navigation";
import { demandToRows } from "@/lib/data/mappers";
import { getLocalBundle, requireUser } from "@/lib/data/queries";
import { firstError, onboardingSchema } from "@/lib/forms";
import { getTemplate, templateDemand, templateRoles, templateShifts } from "@/lib/schedule/templates";
import { activeSlots } from "@/lib/schedule/types";
import { createClient } from "@/lib/supabase/server";

export interface OnboardingState {
  error?: string;
}

export async function createLocal(_prev: OnboardingState, formData: FormData): Promise<OnboardingState> {
  await requireUser();
  if (await getLocalBundle()) redirect("/app");

  const parsed = onboardingSchema.safeParse({
    nombre: formData.get("nombre"),
    tipo: formData.get("tipo") ?? undefined,
    puestos: formData.getAll("puesto"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  // La plantilla del sector pone franjas, colores y necesidades de partida.
  const template = getTemplate(parsed.data.tipo);
  const roles = templateRoles(template, parsed.data.puestos);
  const shifts = templateShifts(template);

  const supabase = await createClient();
  // Todo en una operación atómica: local + franjas + puestos + necesidades.
  const { error } = await supabase.rpc("crear_local", {
    p_nombre: parsed.data.nombre,
    p_puestos: roles.map((r) => ({ clave: r.key, nombre: r.name, color: r.color })),
    p_demanda: demandToRows(templateDemand(template, roles)),
    p_franjas: activeSlots(shifts).map((c) => ({
      franja: c,
      etiqueta: shifts[c].label,
      inicio: shifts[c].start,
      fin: shifts[c].end,
      horas: shifts[c].hours,
      cierre: shifts[c].closing,
    })),
  });
  if (error) return { error: "No se ha podido crear tu negocio. Inténtalo de nuevo." };
  redirect("/app/empleados?nuevo=1");
}
