"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireLocal, requireUser } from "@/lib/data/queries";
import { firstError, settingsSchema, type SettingsInput } from "@/lib/forms";
import { makeRoleKey } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type Result = { ok: true } | { ok: false; error: string };

export async function saveSettings(input: SettingsInput): Promise<Result> {
  const { local } = await requireLocal();
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const s = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("locales")
    .update({
      nombre: s.nombre,
      max_noches_seguidas: s.maxConsecutiveNights,
      descanso_minimo_horas: s.minRestHours,
      min_dias_libres: s.minDaysOff,
      horas_extra_max: s.maxExtraHours,
      fichaje_activo: s.clockIn,
      fichaje_margen_minutos: s.clockMarginMinutes,
    })
    .eq("id", local.id);
  if (error) return { ok: false, error: "No se han podido guardar los ajustes." };
  revalidatePath("/app", "layout");
  return { ok: true };
}

const rolesSchema = z
  .array(
    z.object({
      key: z.string().regex(/^[a-z0-9-]{1,40}$/).optional(),
      name: z.string().trim().min(1, "Todos los puestos necesitan nombre").max(40, "Nombre de puesto demasiado largo"),
      color: z.number().int().min(0).max(9),
    }),
  )
  .min(1, "Necesitas al menos un puesto")
  .max(30, "Máximo 30 puestos");

/**
 * Guarda la lista completa de puestos: crea los nuevos, actualiza los
 * existentes (nombre, color y orden) y borra los que se han quitado. Un puesto
 * con personas asignadas no se puede borrar (lo impide la base de datos).
 */
export type RolesInput = z.input<typeof rolesSchema>;

export async function saveRoles(input: RolesInput): Promise<Result> {
  const { local, roles: current, employees } = await requireLocal();
  const parsed = rolesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const list = parsed.data;

  const names = list.map((r) => r.name.toLowerCase());
  if (new Set(names).size !== names.length) return { ok: false, error: "Hay dos puestos con el mismo nombre." };

  const keepKeys = new Set(list.filter((r) => r.key).map((r) => r.key!));
  const removed = current.filter((r) => !keepKeys.has(r.key));
  const inUse = removed.filter((r) => employees.some((e) => e.role === r.key));
  if (inUse.length) {
    return {
      ok: false,
      error: `No puedes quitar ${inUse.map((r) => `«${r.name}»`).join(", ")}: hay personas con ese puesto. Cámbiales el puesto primero.`,
    };
  }

  const used = current.map((r) => r.key);
  const rows = list.map((r, i) => {
    const key = r.key && used.includes(r.key) ? r.key : makeRoleKey(r.name, used);
    if (!used.includes(key)) used.push(key);
    return { local_id: local.id, clave: key, nombre: r.name, color: r.color, orden: i };
  });

  const supabase = await createClient();
  if (removed.length) {
    const { error } = await supabase
      .from("puestos")
      .delete()
      .eq("local_id", local.id)
      .in(
        "clave",
        removed.map((r) => r.key),
      );
    if (error) return { ok: false, error: "No se han podido quitar algunos puestos." };
  }
  const { error } = await supabase.from("puestos").upsert(rows);
  if (error) return { ok: false, error: "No se han podido guardar los puestos." };

  revalidatePath("/app", "layout");
  return { ok: true };
}

/**
 * Borra la cuenta del encargado y TODO lo de su negocio (equipo, cuadrantes,
 * fichajes…). Para evitar sustos, hay que escribir el nombre del local.
 */
export async function deleteAccount(confirmName: string): Promise<Result> {
  const userId = await requireUser();
  const { local } = await requireLocal();
  if (confirmName.trim().toLowerCase() !== local.nombre.trim().toLowerCase()) {
    return { ok: false, error: "El nombre no coincide. Escríbelo tal cual aparece." };
  }
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { ok: false, error: "No se ha podido borrar la cuenta. Inténtalo de nuevo." };
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/?cuenta=borrada");
}
