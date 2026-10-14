import "server-only";
import { addDays, mondayOf, todayInMadrid } from "@/lib/dates";
import { createAdminClient } from "@/lib/supabase/admin";
import { franjasToCatalog, snapshotToGrid, type FranjaRow, type Snapshot } from "./mappers";

/**
 * Datos para la vista pública del empleado (/h/<token>).
 * Usa el cliente admin (sin RLS), así que AQUÍ es donde se controla el acceso:
 * solo se devuelve información del local del empleado dueño del token, y solo
 * semanas PUBLICADAS (nunca borradores).
 */

export interface PublishedWeek {
  id: string;
  monday: string;
  grid: ReturnType<typeof snapshotToGrid>;
}

export async function getEmployeeByToken(token: string) {
  if (!/^[a-f0-9]{32}$/.test(token)) return null;
  const db = createAdminClient();
  const { data } = await db
    .from("empleados")
    .select("id, nombre, puesto, local_id, activo")
    .eq("token_acceso", token)
    .eq("activo", true)
    .maybeSingle();
  return data as { id: string; nombre: string; puesto: string; local_id: string } | null;
}

export async function getEmployeeView(token: string) {
  const me = await getEmployeeByToken(token);
  if (!me) return null;
  const db = createAdminClient();

  const today = todayInMadrid();
  const thisMonday = mondayOf(today);
  const nextMonday = addDays(thisMonday, 7);

  const [localRes, teamRes, weeksRes, shiftsRes, reqRes] = await Promise.all([
    db.from("locales").select("nombre").eq("id", me.local_id).single(),
    db.from("empleados").select("id, nombre, puesto").eq("local_id", me.local_id).eq("activo", true).order("created_at"),
    db
      .from("semanas")
      .select("id, fecha_inicio, publicado")
      .eq("local_id", me.local_id)
      .in("fecha_inicio", [thisMonday, nextMonday])
      .not("publicado", "is", null),
    db.from("franjas").select("franja, etiqueta, inicio, fin, horas").eq("local_id", me.local_id),
    db
      .from("solicitudes")
      .select("id, tipo, dia, estado, created_at, semana_id, con_empleado_id")
      .eq("empleado_id", me.id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const team = (teamRes.data ?? []) as { id: string; nombre: string; puesto: string }[];
  const ids = team.map((t) => t.id);
  const weeks: PublishedWeek[] = ((weeksRes.data ?? []) as { id: string; fecha_inicio: string; publicado: Snapshot }[])
    .map((w) => ({ id: w.id, monday: w.fecha_inicio, grid: snapshotToGrid(ids, w.publicado) }))
    .sort((a, b) => a.monday.localeCompare(b.monday));

  return {
    me,
    token,
    localName: (localRes.data?.nombre as string) ?? "",
    team,
    weeks,
    today,
    shifts: franjasToCatalog((shiftsRes.data ?? []) as FranjaRow[]),
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
