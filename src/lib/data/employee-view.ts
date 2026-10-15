import "server-only";
import { addDays, mondayOf, todayInMadrid } from "@/lib/dates";
import { createAdminClient } from "@/lib/supabase/admin";
import { franjasToCatalog, snapshotToGrid, type AbsenceReason, type FranjaRow, type Snapshot } from "./mappers";
import { tokenFromPath } from "@/lib/employee-link";

/**
 * Datos para la vista pública del empleado (/h/<token>) y su calendario.
 * Usa el cliente admin (sin RLS), así que AQUÍ es donde se controla el acceso:
 * solo se devuelve información del local del empleado dueño del token, y solo
 * semanas PUBLICADAS (nunca borradores).
 */

export interface PublishedWeek {
  id: string;
  monday: string;
  grid: ReturnType<typeof snapshotToGrid>;
}

interface Me {
  id: string;
  nombre: string;
  puesto: string;
  local_id: string;
}

/** Acepta el enlace con nombre ("laura-<token>") o solo el token. */
export async function getEmployeeByToken(param: string): Promise<Me | null> {
  const token = tokenFromPath(param);
  if (!token) return null;
  const db = createAdminClient();
  const { data } = await db
    .from("empleados")
    .select("id, nombre, puesto, local_id")
    .eq("token_acceso", token)
    .eq("activo", true)
    .maybeSingle();
  return data as Me | null;
}

async function loadPublished(me: Me, fromMonday: string, toMonday: string) {
  const db = createAdminClient();
  const [localRes, teamRes, weeksRes, shiftsRes, puestoRes, absRes] = await Promise.all([
    db.from("locales").select("nombre").eq("id", me.local_id).single(),
    db.from("empleados").select("id, nombre, puesto").eq("local_id", me.local_id).eq("activo", true).order("created_at"),
    db
      .from("semanas")
      .select("id, fecha_inicio, publicado")
      .eq("local_id", me.local_id)
      .gte("fecha_inicio", fromMonday)
      .lte("fecha_inicio", toMonday)
      .not("publicado", "is", null)
      .order("fecha_inicio"),
    db.from("franjas").select("franja, etiqueta, inicio, fin, horas").eq("local_id", me.local_id),
    db.from("puestos").select("clave, nombre").eq("local_id", me.local_id),
    db
      .from("ausencias")
      .select("desde, hasta, motivo")
      .eq("empleado_id", me.id)
      .lte("desde", addDays(toMonday, 6))
      .gte("hasta", fromMonday),
  ]);

  const team = (teamRes.data ?? []) as { id: string; nombre: string; puesto: string }[];
  const ids = team.map((t) => t.id);
  const weeks: PublishedWeek[] = ((weeksRes.data ?? []) as { id: string; fecha_inicio: string; publicado: Snapshot }[]).map((w) => ({
    id: w.id,
    monday: w.fecha_inicio,
    grid: snapshotToGrid(ids, w.publicado),
  }));
  const roleNames = Object.fromEntries(((puestoRes.data ?? []) as { clave: string; nombre: string }[]).map((p) => [p.clave, p.nombre]));
  const absences = (absRes.data ?? []) as { desde: string; hasta: string; motivo: AbsenceReason }[];

  return {
    localName: (localRes.data?.nombre as string) ?? "",
    team,
    weeks,
    shifts: franjasToCatalog((shiftsRes.data ?? []) as FranjaRow[]),
    roleNames,
    /** Motivo de ausencia de un día concreto (o null). */
    absenceOn: (iso: string) => absences.find((a) => iso >= a.desde && iso <= a.hasta)?.motivo ?? null,
  };
}

/** Esta semana y la siguiente, para la página del empleado. */
export async function getEmployeeView(token: string) {
  const me = await getEmployeeByToken(token);
  if (!me) return null;
  const db = createAdminClient();
  const today = todayInMadrid();
  const thisMonday = mondayOf(today);

  const [data, reqRes] = await Promise.all([
    loadPublished(me, thisMonday, addDays(thisMonday, 7)),
    db
      .from("solicitudes")
      .select("id, tipo, dia, estado, semana_id, con_empleado_id")
      .eq("empleado_id", me.id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  return {
    me,
    token,
    today,
    ...data,
    requests: (reqRes.data ?? []) as {
      id: string;
      tipo: "librar" | "intercambio";
      dia: number;
      estado: "pendiente" | "aceptada" | "rechazada";
      semana_id: string;
      con_empleado_id: string | null;
    }[],
  };
}

/** Las últimas 4 semanas y las próximas 4 publicadas, para el calendario. */
export async function getEmployeeCalendar(token: string) {
  const me = await getEmployeeByToken(token);
  if (!me) return null;
  const thisMonday = mondayOf(todayInMadrid());
  const data = await loadPublished(me, addDays(thisMonday, -28), addDays(thisMonday, 28));
  return { me, ...data };
}
