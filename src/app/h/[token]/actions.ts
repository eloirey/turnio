"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { AVISO_COLUMNS, toAvisos, type Aviso, type AvisoRow } from "@/lib/avisos";
import { checkPlace, madridWeekday, type Position } from "@/lib/clock-place";
import { clientIp } from "@/lib/client-ip";
import { getEmployeeByToken, placeConfig } from "@/lib/data/employee-view";
import { groupByEmployeeDay, madridToIso, placeText, type ClockDayRow, type ClockPlace } from "@/lib/fichajes";
import { addDays } from "@/lib/dates";
import { toClockRecords, type FichajeRow } from "@/lib/data/mappers";
import { deliverPush, removeSubscription, saveSubscription } from "@/lib/push";
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
  after(() => deliverPush().catch(() => undefined));
  return { ok: true };
}

export type PunchResult =
  | { ok: true; estado: "dentro" | "fuera"; desde?: string; hasta?: string; olvidado: boolean; place: ClockPlace | null; distance: number | null }
  | { ok: false; error: string };

const positionSchema = z
  .object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), accuracy: z.number().min(0).max(100_000).nullish() })
  .nullish();

/**
 * Fichar entrada o salida desde el enlace personal. La hora la pone la base
 * de datos (no el móvil), y un doble toque no crea tramos de segundos.
 * Si el local lo pide, se comprueba que esté en el local (por la ubicación
 * del móvil o por la wifi). Solo se guarda el resultado, no la ubicación.
 */
export async function punchClock(token: string, position?: Position | null): Promise<PunchResult> {
  const me = await getEmployeeByToken(token);
  if (!me) return { ok: false, error: "Este enlace ya no es válido." };
  const pos = positionSchema.safeParse(position);
  const db = createAdminClient();
  const { data: local } = await db
    .from("locales")
    .select("fichaje_control, fichaje_lat, fichaje_lng, fichaje_radio_m, fichaje_ips")
    .eq("id", me.local_id)
    .single();
  const check = checkPlace(placeConfig(local), {
    position: pos.success ? pos.data : null,
    ip: await clientIp(),
    remoteToday: (me.teletrabajo_dias ?? []).includes(madridWeekday()),
  });
  if (check.blocked) {
    return {
      ok: false,
      error:
        check.place === "sin_datos"
          ? "Para fichar tienes que estar en el local. Permite la ubicación en tu navegador (o conéctate a la wifi del local) y vuelve a intentarlo."
          : `Estás a ${placeText("fuera", check.distance).replace("Fuera del local (a ", "").replace(")", "")} del local. Solo se puede fichar desde allí; si es un error, avisa a tu encargado.`,
    };
  }
  const { data, error } = await db.rpc("fichar", {
    p_token: tokenFromPath(token),
    p_ubicacion: check.place,
    p_distancia: check.place === "fuera" ? check.distance : null,
  });
  if (error) {
    return { ok: false, error: error.message.includes("no está activado") ? "Tu encargado aún no ha activado el fichaje." : "No se ha podido fichar. Inténtalo de nuevo." };
  }
  revalidatePath(`/h/${token}`);
  after(() => deliverPush().catch(() => undefined));
  return { ok: true, ...(data as { estado: "dentro" | "fuera"; desde?: string; hasta?: string; olvidado: boolean }), place: check.place, distance: check.distance };
}

// ---------- Avisos del empleado ----------

/** Los avisos de esta persona (solo los suyos: se filtra por su token). */
export async function loadEmployeeAvisos(token: string): Promise<{ ok: true; items: Aviso[]; unread: number } | { ok: false }> {
  const me = await getEmployeeByToken(token);
  if (!me) return { ok: false };
  after(() => deliverPush().catch(() => undefined));
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

// ---------- Avisos en el móvil ----------

export async function savePushEmployee(token: string, subscription: unknown): Promise<{ ok: boolean }> {
  const me = await getEmployeeByToken(token);
  if (!me) return { ok: false };
  return { ok: await saveSubscription(subscription, { localId: me.local_id, employeeId: me.id }) };
}

export async function removePushEmployee(token: string, endpoint: string): Promise<{ ok: boolean }> {
  const me = await getEmployeeByToken(token);
  if (!me) return { ok: false };
  return { ok: await removeSubscription(endpoint, { localId: me.local_id, employeeId: me.id }) };
}

// ---------- Mi registro de jornada ----------

export type MyClockResult = { ok: true; month: string; rows: ClockDayRow[]; now: string; localName: string; name: string } | { ok: false; error: string };

/** Los fichajes de esta persona en un mes (tiene derecho a consultarlos). */
export async function loadMyClock(token: string, month: string): Promise<MyClockResult> {
  const me = await getEmployeeByToken(token);
  if (!me) return { ok: false, error: "Este enlace ya no es válido." };
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return { ok: false, error: "Mes no válido." };
  const [y, m] = month.split("-").map(Number);
  const first = `${month}-01`;
  const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const db = createAdminClient();
  const [{ data, error }, { data: local }] = await Promise.all([
    db
      .from("fichajes")
      .select("id, empleado_id, entrada, salida, sin_salida, editado, ubicacion_entrada, ubicacion_salida, distancia_entrada_m, distancia_salida_m")
      .eq("empleado_id", me.id)
      .gte("entrada", madridToIso(addDays(first, -1), "00:00"))
      .lte("entrada", madridToIso(addDays(last, 1), "23:59"))
      .order("entrada"),
    db.from("locales").select("nombre").eq("id", me.local_id).single(),
  ]);
  if (error) return { ok: false, error: "No se ha podido cargar tu registro." };
  const byDay = groupByEmployeeDay(toClockRecords((data ?? []) as FichajeRow[]));
  const rows: ClockDayRow[] = [];
  for (const [key, records] of byDay) {
    const date = key.split("|")[1];
    if (!date.startsWith(month)) continue;
    rows.push({ date, name: me.nombre, role: "", records, planned: "", status: records.some((r) => r.missingEnd) ? "forgot" : "none" });
  }
  rows.sort((a, b) => a.date.localeCompare(b.date));
  return { ok: true, month, rows, now: new Date().toISOString(), localName: (local?.nombre as string) ?? "", name: me.nombre };
}
