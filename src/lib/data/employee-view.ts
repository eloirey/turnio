import "server-only";
import { addDays, mondayOf, todayInMadrid } from "@/lib/dates";
import { AVISO_COLUMNS, toAvisos, type AvisoRow } from "@/lib/avisos";
import { checksPlace, madridWeekday, type LocalPlaceConfig } from "@/lib/clock-place";
import { createAdminClient } from "@/lib/supabase/admin";
import { franjasToCatalog, snapshotToGrid, toClockRecords, type AbsenceReason, type FichajeRow, type FranjaRow, type Snapshot } from "./mappers";
import { tokenFromPath } from "@/lib/employee-link";
import { madridToIso } from "@/lib/fichajes";


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
  teletrabajo_dias: number[] | null;
}

/** Acepta el enlace con nombre ("laura-<token>") o solo el token. */
export async function getEmployeeByToken(param: string): Promise<Me | null> {
  const token = tokenFromPath(param);
  if (!token) return null;
  const db = createAdminClient();
  const { data } = await db
    .from("empleados")
    .select("id, nombre, puesto, local_id, teletrabajo_dias")
    .eq("token_acceso", token)
    .eq("activo", true)
    .maybeSingle();
  return data as Me | null;
}

async function loadPublished(me: Me, fromMonday: string, toMonday: string) {
  const db = createAdminClient();
  const [localRes, teamRes, weeksRes, shiftsRes, puestoRes, absRes] = await Promise.all([
    db.from("locales").select("nombre, fichaje_activo, fichaje_control, fichaje_lat, fichaje_lng, fichaje_radio_m, fichaje_ips").eq("id", me.local_id).single(),
    db.from("empleados").select("id, nombre, puesto").eq("local_id", me.local_id).eq("activo", true).order("created_at"),
    db
      .from("semanas")
      .select("id, fecha_inicio, publicado")
      .eq("local_id", me.local_id)
      .gte("fecha_inicio", fromMonday)
      .lte("fecha_inicio", toMonday)
      .not("publicado", "is", null)
      .order("fecha_inicio"),
    db.from("franjas").select("franja, etiqueta, inicio, fin, inicio2, fin2, horas, cierre, orden, activa").eq("local_id", me.local_id),
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
    clockEnabled: Boolean(localRes.data?.fichaje_activo),
    /** ¿Se comprueba desde dónde ficha? (hoy en teletrabajo, no) */
    clockPlace: {
      checks: checksPlace(placeConfig(localRes.data)),
      remoteToday: (me.teletrabajo_dias ?? []).includes(madridWeekday()),
    },
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

  const [data, reqRes, clockRes, avisosRes] = await Promise.all([
    loadPublished(me, thisMonday, addDays(thisMonday, 7)),
    db
      .from("solicitudes")
      .select("id, tipo, dia, estado, semana_id, con_empleado_id")
      .eq("empleado_id", me.id)
      .order("created_at", { ascending: false })
      .limit(5),
    // Fichajes de esta semana y, si lo hay, el tramo que sigue abierto aunque empezara antes.
    db
      .from("fichajes")
      .select("id, empleado_id, entrada, salida, sin_salida, editado")
      .eq("empleado_id", me.id)
      .or(`entrada.gte.${madridToIso(thisMonday, "00:00")},and(salida.is.null,sin_salida.is.false)`)
      .order("entrada"),
    db.from("avisos").select(AVISO_COLUMNS).eq("empleado_id", me.id).order("creado_en", { ascending: false }).limit(20),
  ]);
  const avisos = toAvisos((avisosRes.data ?? []) as AvisoRow[]);

  return {
    me,
    token,
    today,
    ...data,
    clock: toClockRecords((clockRes.data ?? []) as FichajeRow[]),
    avisos: { items: avisos, unread: avisos.filter((a) => !a.leido).length },
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

/** Configuración de «dónde se ficha» de una fila de locales. */
export function placeConfig(row: Record<string, unknown> | null | undefined): LocalPlaceConfig {
  return {
    control: (row?.fichaje_control as LocalPlaceConfig["control"]) ?? "no",
    lat: (row?.fichaje_lat as number | null) ?? null,
    lng: (row?.fichaje_lng as number | null) ?? null,
    radius: (row?.fichaje_radio_m as number) ?? 200,
    ips: (row?.fichaje_ips as string[]) ?? [],
  };
}
