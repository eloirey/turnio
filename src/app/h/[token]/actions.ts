"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AVISO_COLUMNS, toAvisos, type Aviso, type AvisoRow } from "@/lib/avisos";
import { getEmployeeByToken } from "@/lib/data/employee-view";
import { tokenFromPath } from "@/lib/employee-link";
import { createAdminClient } from "@/lib/supabase/admin";

export interface RequestState {
  ok?: boolean;
  error?: string;
}

const schema = z
  .object({
    weekId: z.uuid(),
    tipo: z.enum(["librar", "intercambio"]),
    dia: z.coerce.number().int().min(0).max(6),
    conEmpleadoId: z.union([z.uuid(), z.literal("")]).optional(),
    mensaje: z.string().trim().max(500).optional(),
  })
  .refine((d) => d.tipo !== "intercambio" || Boolean(d.conEmpleadoId), {
    message: "Elige con quién quieres cambiarte",
  });

/** Un empleado (identificado por su token) pide un cambio. */
export async function submitRequest(token: string, _prev: RequestState, formData: FormData): Promise<RequestState> {
  const me = await getEmployeeByToken(token);
  if (!me) return { error: "Este enlace ya no es válido." };

  const parsed = schema.safeParse({
    weekId: formData.get("weekId"),
    tipo: formData.get("tipo"),
    dia: formData.get("dia"),
    conEmpleadoId: formData.get("conEmpleadoId") ?? "",
    mensaje: formData.get("mensaje") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { weekId, tipo, dia, conEmpleadoId, mensaje } = parsed.data;

  const db = createAdminClient();

  // La semana debe ser de SU local y estar publicada.
  const { data: week } = await db
    .from("semanas")
    .select("id")
    .eq("id", weekId)
    .eq("local_id", me.local_id)
    .not("publicado", "is", null)
    .maybeSingle();
  if (!week) return { error: "Esa semana no está disponible." };

  // El compañero debe ser del mismo local y no él mismo.
  if (tipo === "intercambio") {
    if (conEmpleadoId === me.id) return { error: "Elige a otra persona." };
    const { data: mate } = await db
      .from("empleados")
      .select("id")
      .eq("id", conEmpleadoId!)
      .eq("local_id", me.local_id)
      .eq("activo", true)
      .maybeSingle();
    if (!mate) return { error: "Ese compañero no existe." };
  }

  // Evitar solicitudes duplicadas para el mismo día.
  const { count } = await db
    .from("solicitudes")
    .select("id", { count: "exact", head: true })
    .eq("empleado_id", me.id)
    .eq("semana_id", weekId)
    .eq("dia", dia)
    .eq("estado", "pendiente");
  if (count) return { error: "Ya tienes una solicitud pendiente para ese día." };

  const { error } = await db.from("solicitudes").insert({
    semana_id: weekId,
    empleado_id: me.id,
    tipo,
    dia,
    con_empleado_id: tipo === "intercambio" ? conEmpleadoId : null,
    mensaje: mensaje || null,
  });
  if (error) return { error: "No se ha podido enviar. Inténtalo de nuevo." };

  revalidatePath(`/h/${token}`);
  return { ok: true };
}

export type PunchResult =
  | { ok: true; estado: "dentro" | "fuera"; desde?: string; hasta?: string; olvidado: boolean }
  | { ok: false; error: string };

/**
 * Fichar entrada o salida desde el enlace personal. La hora la pone la base
 * de datos (no el móvil), y un doble toque no crea tramos de segundos.
 */
export async function punchClock(token: string): Promise<PunchResult> {
  const me = await getEmployeeByToken(token);
  if (!me) return { ok: false, error: "Este enlace ya no es válido." };
  const db = createAdminClient();
  const { data, error } = await db.rpc("fichar", { p_token: tokenFromPath(token) });
  if (error) {
    return { ok: false, error: error.message.includes("no está activado") ? "Tu encargado aún no ha activado el fichaje." : "No se ha podido fichar. Inténtalo de nuevo." };
  }
  revalidatePath(`/h/${token}`);
  return { ok: true, ...(data as { estado: "dentro" | "fuera"; desde?: string; hasta?: string; olvidado: boolean }) };
}

// ---------- Avisos del empleado ----------

/** Los avisos de esta persona (solo los suyos: se filtra por su token). */
export async function loadEmployeeAvisos(token: string): Promise<{ ok: true; items: Aviso[]; unread: number } | { ok: false }> {
  const me = await getEmployeeByToken(token);
  if (!me) return { ok: false };
  const db = createAdminClient();
  const { data, error } = await db.from("avisos").select(AVISO_COLUMNS).eq("empleado_id", me.id).order("creado_en", { ascending: false }).limit(20);
  if (error) return { ok: false };
  const items = toAvisos((data ?? []) as AvisoRow[]);
  return { ok: true, items, unread: items.filter((a) => !a.leido).length };
}

export async function readEmployeeAvisos(token: string): Promise<{ ok: boolean }> {
  const me = await getEmployeeByToken(token);
  if (!me) return { ok: false };
  const db = createAdminClient();
  const { error } = await db.from("avisos").update({ leido_en: new Date().toISOString() }).eq("empleado_id", me.id).is("leido_en", null);
  return { ok: !error };
}
