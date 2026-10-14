"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isValidISODate } from "@/lib/dates";
import { availabilityToRows } from "@/lib/data/mappers";
import { requireLocal, requireUser } from "@/lib/data/queries";
import { createClient } from "@/lib/supabase/server";

const week = z.array(z.boolean()).length(7);

const employeeSchema = z.object({
  id: z.uuid().optional(),
  nombre: z.string().trim().min(1, "Escribe el nombre").max(80),
  puesto: z.string().min(1, "Elige un puesto"),
  horasContrato: z.number({ error: "Indica las horas de contrato" }).int("Las horas deben ser un número entero").min(1, "Las horas deben ser al menos 1").max(60, "Máximo 60 horas"),
  telefono: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((v) => (v ? v : null)),
  availability: z.object({ M: week, T: week, N: week }),
});

export type EmployeeInput = z.input<typeof employeeSchema>;
export type ActionResult = { ok: true; id: string } | { ok: false; error: string };

export async function saveEmployee(input: EmployeeInput): Promise<ActionResult> {
  const { local, roles } = await requireLocal();
  const parsed = employeeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { id, nombre, puesto, horasContrato, telefono, availability } = parsed.data;
  if (!roles.some((r) => r.key === puesto)) return { ok: false, error: "Ese puesto no existe. Créalo en Ajustes." };

  const supabase = await createClient();
  const fields = { nombre, puesto, horas_contrato: horasContrato, telefono };

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

  // Disponibilidad: se sustituye entera (borrar + insertar).
  const { error: delErr } = await supabase.from("disponibilidad").delete().eq("empleado_id", employeeId);
  if (delErr) return { ok: false, error: "Se guardaron los datos, pero no la disponibilidad." };
  const rows = availabilityToRows(employeeId, availability);
  if (rows.length) {
    const { error: insErr } = await supabase.from("disponibilidad").insert(rows);
    if (insErr) return { ok: false, error: "Se guardaron los datos, pero no la disponibilidad." };
  }

  revalidatePath("/app", "layout");
  return { ok: true, id: employeeId };
}

export async function deleteEmployee(id: string): Promise<ActionResult> {
  const { local } = await requireLocal();
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Persona no válida." };
  const supabase = await createClient();
  const { error } = await supabase.from("empleados").delete().eq("id", id).eq("local_id", local.id);
  if (error) return { ok: false, error: "No se ha podido eliminar." };
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

export async function addAbsence(input: z.input<typeof absenceSchema>): Promise<ActionResult> {
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
