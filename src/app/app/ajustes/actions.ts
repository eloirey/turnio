"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireLocal, requireUser } from "@/lib/data/queries";
import { firstError, settingsSchema, type SettingsInput } from "@/lib/forms";
import { clientIp } from "@/lib/client-ip";
import { makeRoleKey } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getBaseUrl } from "@/lib/url";

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
      fichaje_control: s.clockControl,
      fichaje_radio_m: s.clockRadius,
    })
    .eq("id", local.id);
  if (error) return { ok: false, error: "No se han podido guardar los ajustes." };
  revalidatePath("/app", "layout");
  return { ok: true };
}

// ---------- Dónde se puede fichar ----------

const coords = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });

/** «Estoy en el local»: guarda la ubicación que da el móvil del encargado. */
export async function saveClockPlace(input: { lat: number; lng: number }): Promise<Result> {
  const { local } = await requireLocal();
  const parsed = coords.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ubicación no válida." };
  const supabase = await createClient();
  const { error } = await supabase.from("locales").update({ fichaje_lat: parsed.data.lat, fichaje_lng: parsed.data.lng }).eq("id", local.id);
  if (error) return { ok: false, error: "No se ha podido guardar la ubicación." };
  revalidatePath("/app", "layout");
  return { ok: true };
}

export async function clearClockPlace(): Promise<Result> {
  const { local } = await requireLocal();
  const supabase = await createClient();
  const { error } = await supabase.from("locales").update({ fichaje_lat: null, fichaje_lng: null }).eq("id", local.id);
  if (error) return { ok: false, error: "No se ha podido quitar la ubicación." };
  revalidatePath("/app", "layout");
  return { ok: true };
}

/** «Estoy conectado a la wifi del local»: guarda la IP pública de esta conexión. */
export async function addClockWifi(): Promise<Result> {
  const { local, settings } = await requireLocal();
  const ip = await clientIp();
  if (!ip) return { ok: false, error: "No se ha podido saber qué conexión estás usando." };
  if (settings.clockIps.includes(ip)) return { ok: true };
  if (settings.clockIps.length >= 5) return { ok: false, error: "Como mucho 5 conexiones. Quita alguna antes." };
  const supabase = await createClient();
  const { error } = await supabase.from("locales").update({ fichaje_ips: [...settings.clockIps, ip] }).eq("id", local.id);
  if (error) return { ok: false, error: "No se ha podido guardar la wifi." };
  revalidatePath("/app", "layout");
  return { ok: true };
}

export async function removeClockWifi(ip: string): Promise<Result> {
  const { local, settings } = await requireLocal();
  const supabase = await createClient();
  const { error } = await supabase.from("locales").update({ fichaje_ips: settings.clockIps.filter((x) => x !== ip) }).eq("id", local.id);
  if (error) return { ok: false, error: "No se ha podido quitar la wifi." };
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
  if (local.es_dueno === false) return { ok: false, error: "Solo el dueño de la cuenta puede borrar el negocio. Si quieres dejar de gestionarlo, pulsa «Salir» en Encargados." };
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

// ---------- Encargados ----------

export interface ManagersInfo {
  isOwner: boolean;
  me: string;
  owner: { email: string | null; isMe: boolean };
  members: { userId: string; email: string | null; since: string; isMe: boolean }[];
  invites: { id: string; link: string; expires: string }[];
}

/** Quién gestiona el negocio y las invitaciones pendientes. */
export async function loadManagers(): Promise<{ ok: true; data: ManagersInfo } | { ok: false; error: string }> {
  const { local } = await requireLocal();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const me = claims?.claims?.sub as string;
  const [ownerRes, membersRes, invitesRes, base] = await Promise.all([
    supabase.from("locales").select("owner_id").eq("id", local.id).single(),
    supabase.from("local_miembros").select("user_id, email, creado_en").eq("local_id", local.id).order("creado_en"),
    supabase.from("invitaciones").select("id, token, expira_en").eq("local_id", local.id).is("usada_por", null).gt("expira_en", new Date().toISOString()).order("creada_en"),
    getBaseUrl(),
  ]);
  if (ownerRes.error || !ownerRes.data) return { ok: false, error: "No se han podido cargar los encargados." };
  const ownerId = ownerRes.data.owner_id as string;
  let ownerEmail: string | null = ownerId === me ? ((claims?.claims?.email as string) ?? null) : null;
  if (!ownerEmail) {
    const { data } = await createAdminClient().auth.admin.getUserById(ownerId);
    ownerEmail = data?.user?.email ?? null;
  }
  return {
    ok: true,
    data: {
      isOwner: ownerId === me,
      me,
      owner: { email: ownerEmail, isMe: ownerId === me },
      members: ((membersRes.data ?? []) as { user_id: string; email: string | null; creado_en: string }[]).map((m) => ({
        userId: m.user_id,
        email: m.email,
        since: m.creado_en,
        isMe: m.user_id === me,
      })),
      invites: ((invitesRes.data ?? []) as { id: string; token: string; expira_en: string }[]).map((i) => ({ id: i.id, link: `${base}/invitacion/${i.token}`, expires: i.expira_en })),
    },
  };
}

/** Crea un enlace de invitación (vale 7 días y una sola vez). */
export async function createInvite(): Promise<{ ok: true; link: string } | { ok: false; error: string }> {
  const { local } = await requireLocal();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const { count } = await supabase.from("invitaciones").select("id", { count: "exact", head: true }).eq("local_id", local.id).is("usada_por", null).gt("expira_en", new Date().toISOString());
  if ((count ?? 0) >= 10) return { ok: false, error: "Tienes muchas invitaciones sin usar. Anula alguna antes." };
  const { data, error } = await supabase
    .from("invitaciones")
    .insert({ local_id: local.id, creada_por: claims?.claims?.sub })
    .select("token")
    .single();
  if (error || !data) return { ok: false, error: "No se ha podido crear la invitación." };
  return { ok: true, link: `${await getBaseUrl()}/invitacion/${data.token}` };
}

export async function revokeInvite(id: string): Promise<Result> {
  await requireLocal();
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Invitación no válida." };
  const supabase = await createClient();
  const { error } = await supabase.from("invitaciones").delete().eq("id", id);
  if (error) return { ok: false, error: "No se ha podido anular." };
  return { ok: true };
}

/** El dueño quita a un encargado (la base de datos solo se lo deja al dueño). */
export async function removeManager(userId: string): Promise<Result> {
  const { local } = await requireLocal();
  if (!z.guid().safeParse(userId).success) return { ok: false, error: "Persona no válida." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("local_miembros").delete().eq("local_id", local.id).eq("user_id", userId).select("user_id");
  if (error || !data?.length) return { ok: false, error: "No se ha podido quitar." };
  // Sus dispositivos dejan de recibir los avisos de este negocio.
  await createAdminClient().from("push_suscripciones").delete().eq("local_id", local.id).eq("usuario_id", userId);
  return { ok: true };
}

/** Un encargado invitado deja de gestionar el negocio. */
export async function leaveLocal(): Promise<Result> {
  const { local } = await requireLocal();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const me = claims?.claims?.sub as string;
  const { data, error } = await supabase.from("local_miembros").delete().eq("local_id", local.id).eq("user_id", me).select("user_id");
  if (error || !data?.length) return { ok: false, error: "No se ha podido salir." };
  await createAdminClient().from("push_suscripciones").delete().eq("local_id", local.id).eq("usuario_id", me);
  revalidatePath("/app", "layout");
  redirect("/bienvenida");
}
