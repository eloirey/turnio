"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { demandToRows } from "@/lib/data/mappers";
import { getLocalBundle, requireUser } from "@/lib/data/queries";
import { firstError, onboardingSchema } from "@/lib/forms";
import { customShifts, getTemplate, templateDemand, templateRoles, templateShifts } from "@/lib/schedule/templates";
import { activeSlots } from "@/lib/schedule/types";
import { sendWelcome } from "@/lib/email/send";
import { createClient } from "@/lib/supabase/server";
import { getBaseUrl } from "@/lib/url";

export interface OnboardingState {
  error?: string;
}

export async function createLocal(_prev: OnboardingState, formData: FormData): Promise<OnboardingState> {
  await requireUser();
  if (await getLocalBundle()) redirect("/app/cuadrante");

  const parsed = onboardingSchema.safeParse({
    nombre: formData.get("nombre"),
    tipo: formData.get("tipo") ?? undefined,
    puestos: formData.getAll("puesto"),
    franjas: readShifts(formData),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  // La plantilla del sector pone franjas, colores y necesidades de partida.
  const template = getTemplate(parsed.data.tipo);
  const roles = templateRoles(template, parsed.data.puestos);
  const shifts = parsed.data.franjas ? customShifts(template, parsed.data.franjas) : templateShifts(template);

  const supabase = await createClient();
  // Todo en una operación atómica: local + franjas + puestos + necesidades.
  const { error } = await supabase.rpc("crear_local", {
    p_nombre: parsed.data.nombre,
    p_puestos: roles.map((r) => ({ clave: r.key, nombre: r.name, color: r.color })),
    p_demanda: demandToRows(templateDemand(template, roles, shifts)),
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

  // Correo de bienvenida con los primeros pasos (después de responder, sin hacer esperar).
  const [{ data: claims }, base] = await Promise.all([supabase.auth.getClaims(), getBaseUrl()]);
  const email = claims?.claims?.email as string | undefined;
  const localName = parsed.data.nombre;
  after(() => sendWelcome(email, localName, base).catch(() => false));
  redirect("/app/empleados?nuevo=1");
}

/** Las franjas del formulario llegan como listas paralelas (una fila por franja). */
function readShifts(formData: FormData) {
  const labels = formData.getAll("franja_nombre").map(String);
  if (!labels.length) return undefined;
  const codes = formData.getAll("franja_codigo").map(String);
  const starts = formData.getAll("franja_inicio").map(String);
  const ends = formData.getAll("franja_fin").map(String);
  return labels.map((label, i) => ({ code: codes[i] || undefined, label, start: starts[i] ?? "", end: ends[i] ?? "" }));
}
