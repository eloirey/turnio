"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { availabilityToRows } from "@/lib/data/mappers";
import { requireLocal } from "@/lib/data/queries";
import { ROLES } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

const week = z.array(z.boolean()).length(7);

const employeeSchema = z.object({
  id: z.uuid().optional(),
  nombre: z.string().trim().min(1, "Escribe el nombre").max(80),
  puesto: z.enum(ROLES, { error: "Elige un puesto" }),
  horasContrato: z.number().int().min(1, "Las horas deben ser al menos 1").max(60, "Máximo 60 horas"),
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
  const local = await requireLocal();
  const parsed = employeeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { id, nombre, puesto, horasContrato, telefono, availability } = parsed.data;

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
    if (error || !data) return { ok: false, error: "No se ha podido crear el empleado." };
    employeeId = data.id as string;
  }

  // Disponibilidad: se sustituye entera (borrar + insertar).
  const { error: delErr } = await supabase.from("disponibilidad").delete().eq("empleado_id", employeeId);
  if (delErr) return { ok: false, error: "Se guardó el empleado, pero no su disponibilidad." };
  const rows = availabilityToRows(employeeId, availability);
  if (rows.length) {
    const { error: insErr } = await supabase.from("disponibilidad").insert(rows);
    if (insErr) return { ok: false, error: "Se guardó el empleado, pero no su disponibilidad." };
  }

  revalidatePath("/app", "layout");
  return { ok: true, id: employeeId };
}

export async function deleteEmployee(id: string): Promise<ActionResult> {
  const local = await requireLocal();
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Empleado no válido." };
  const supabase = await createClient();
  const { error } = await supabase.from("empleados").delete().eq("id", id).eq("local_id", local.id);
  if (error) return { ok: false, error: "No se ha podido eliminar." };
  revalidatePath("/app", "layout");
  return { ok: true, id };
}
