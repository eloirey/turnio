"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isValidISODate, mondayOf, todayInMadrid } from "@/lib/dates";
import { availabilityToRows } from "@/lib/data/mappers";
import { requireLocal, requireUser } from "@/lib/data/queries";
import { employeeSchema, firstError, type EmployeeInput } from "@/lib/forms";
import { activeSlots } from "@/lib/schedule/types";
import { createClient } from "@/lib/supabase/server";

export type { EmployeeInput };

export type ActionResult = { ok: true; id: string; archived?: boolean } | { ok: false; error: string };

export async function saveEmployee(input: EmployeeInput): Promise<ActionResult> {
  const { local, roles, shifts } = await requireLocal();
  const parsed = employeeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { id, nombre, puesto, horasContrato, telefono, availability, minDaysOff, maxConsecutiveClosings, preferredDaysOff, remoteDays } = parsed.data;
  if (!roles.some((r) => r.key === puesto)) return { ok: false, error: "Ese puesto no existe. Créalo en Ajustes." };

  const supabase = await createClient();
  const fields = {
    nombre,
    puesto,
    horas_contrato: horasContrato,
    telefono: telefono || null,
    min_dias_libres: minDaysOff ?? null,
    max_cierres_seguidos: maxConsecutiveClosings ?? null,
    prefiere_librar: [...new Set(preferredDaysOff ?? [])].sort(),
    teletrabajo_dias: [...new Set(remoteDays ?? [])].sort(),
  };

  let employeeId = id;
  if (employeeId) {
    const { error } = await supabase.from("empleados").update(fields).eq("id", employeeId).eq("local_id", local.id);
    if (error) return { ok: false, error: "No se ha podido guardar." };
  } else {
    const { data, error } = await supabase
      .from("empleados")
      .insert({ ...fields, local_id: local.id })
      .select("id")
      .single();
    if (error || !data) return { ok: false, error: "No se ha podido añadir a esta persona." };
    employeeId = data.id as string;
  }

  // Disponibilidad: se sustituye entera (borrar + insertar), solo con franjas activas.
  const active = new Set(activeSlots(shifts));
  const clean = Object.fromEntries(Object.entries(availability).filter(([slot]) => active.has(slot)));
  const { error: delErr } = await supabase.from("disponibilidad").delete().eq("empleado_id", employeeId);
  if (delErr) return { ok: false, error: "Se guardaron los datos, pero no la disponibilidad." };
  const rows = availabilityToRows(employeeId, clean);
  if (rows.length) {
    const { error: insErr } = await supabase.from("disponibilidad").insert(rows);
    if (insErr) return { ok: false, error: "Se guardaron los datos, pero no la disponibilidad." };
  }

  revalidatePath("/app", "layout");
  return { ok: true, id: employeeId };
}

/**
 * Quita a una persona del equipo. Si tiene fichajes, se archiva en vez de
 * borrarse: la ley obliga a conservar el registro de jornada cuatro años.
 * Al archivarla, su enlace deja de funcionar y se quitan sus turnos futuros.
 */
export async function deleteEmployee(id: string): Promise<ActionResult> {
  const { local } = await requireLocal();
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Persona no válida." };
  const supabase = await createClient();

  const { count } = await supabase.from("fichajes").select("id", { count: "exact", head: true }).eq("empleado_id", id);
  if (count && count > 0) {
    const { error } = await supabase.from("empleados").update({ activo: false }).eq("id", id).eq("local_id", local.id);
    if (error) return { ok: false, error: "No se ha podido quitar del equipo." };
    const monday = mondayOf(todayInMadrid());
    const { data: weeks } = await supabase.from("semanas").select("id").eq("local_id", local.id).gte("fecha_inicio", monday);
    if (weeks?.length) {
      await supabase
        .from("turnos")
        .delete()
        .eq("empleado_id", id)
        .in(
          "semana_id",
          weeks.map((w) => w.id),
        );
    }
    revalidatePath("/app", "layout");
    return { ok: true, id, archived: true };
  }

  const { error } = await supabase.from("empleados").delete().eq("id", id).eq("local_id", local.id);
  if (error) return { ok: false, error: "No se ha podido eliminar." };
  revalidatePath("/app", "layout");
  return { ok: true, id };
}

/**
 * Cambia el enlace personal de una persona (si lo ha perdido o compartido).
 * El enlace anterior deja de funcionar al momento.
 */
export async function newLink(id: string): Promise<ActionResult> {
  const { local } = await requireLocal();
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Persona no válida." };
  const supabase = await createClient();
  const token = crypto.randomUUID().replaceAll("-", "");
  const { data, error } = await supabase.from("empleados").update({ token_acceso: token }).eq("id", id).eq("local_id", local.id).select("id").single();
  if (error || !data) return { ok: false, error: "No se ha podido cambiar el enlace." };
  revalidatePath("/app", "layout");
  return { ok: true, id };
}

const absenceSchema = z
  .object({
    empleadoId: z.uuid(),
    desde: z.string().refine(isValidISODate, "Fecha de inicio no válida"),
    hasta: z.string().refine(isValidISODate, "Fecha de fin no válida"),
    motivo: z.enum(["vacaciones", "baja", "permiso", "otro"]),
    nota: z.string().trim().max(200).optional(),
  })
  .refine((a) => a.hasta >= a.desde, { message: "La fecha de fin no puede ser anterior a la de inicio" });

export type AbsenceInput = z.input<typeof absenceSchema>;

export async function addAbsence(input: AbsenceInput): Promise<ActionResult> {
  await requireUser();
  const parsed = absenceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const a = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ausencias")
    .insert({ empleado_id: a.empleadoId, desde: a.desde, hasta: a.hasta, motivo: a.motivo, nota: a.nota || null })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message.includes("check") ? "Las fechas no son válidas (máximo un año)." : "No se ha podido guardar la ausencia." };
  revalidatePath("/app", "layout");
  return { ok: true, id: data.id as string };
}

export async function deleteAbsence(id: string): Promise<ActionResult> {
  await requireUser();
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Ausencia no válida." };
  const supabase = await createClient();
  const { error } = await supabase.from("ausencias").delete().eq("id", id);
  if (error) return { ok: false, error: "No se ha podido borrar." };
  revalidatePath("/app", "layout");
  return { ok: true, id };
}
