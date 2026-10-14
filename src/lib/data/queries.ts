import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  franjasToCatalog,
  localToRules,
  rowsToDemand,
  rowsToGrid,
  toEmployees,
  type DemandaRow,
  type DisponibilidadRow,
  type EmpleadoRow,
  type FranjaRow,
  type LocalRow,
  type TurnoRow,
} from "./mappers";

/**
 * Lecturas del encargado. Todas usan el cliente con su sesión, así que la
 * base de datos solo devuelve filas de SUS locales (RLS).
 */

export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

export async function getMyLocal(): Promise<LocalRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("locales")
    .select("id, nombre, max_noches_seguidas, prohibir_noche_manana")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as LocalRow | null;
}

/** Usuario con sesión y con local creado; si no, lo manda donde toca. */
export async function requireLocal(): Promise<LocalRow> {
  await requireUser();
  const local = await getMyLocal();
  if (!local) redirect("/bienvenida");
  return local;
}

export async function getEmployees(localId: string) {
  const supabase = await createClient();
  const { data: emps, error } = await supabase
    .from("empleados")
    .select("id, nombre, puesto, horas_contrato, telefono, token_acceso, activo")
    .eq("local_id", localId)
    .eq("activo", true)
    .order("created_at");
  if (error) throw error;
  const rows = (emps ?? []) as EmpleadoRow[];
  if (rows.length === 0) return [];

  const { data: disp, error: e2 } = await supabase
    .from("disponibilidad")
    .select("empleado_id, dia, franja")
    .in(
      "empleado_id",
      rows.map((r) => r.id),
    );
  if (e2) throw e2;
  return toEmployees(rows, (disp ?? []) as DisponibilidadRow[]);
}

export async function getDemand(localId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("demanda").select("dia, franja, puesto, cantidad").eq("local_id", localId);
  if (error) throw error;
  return rowsToDemand((data ?? []) as DemandaRow[]);
}

export async function getShifts(localId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("franjas").select("franja, etiqueta, inicio, fin, horas").eq("local_id", localId);
  if (error) throw error;
  return franjasToCatalog((data ?? []) as FranjaRow[]);
}

export interface WeekRow {
  id: string;
  fecha_inicio: string;
  estado: "borrador" | "publicado" | "cambios";
  publicado_at: string | null;
}

/** Devuelve la semana (la crea vacía si aún no existe). */
export async function getOrCreateWeek(localId: string, monday: string): Promise<{ week: WeekRow; isNew: boolean }> {
  const supabase = await createClient();
  const cols = "id, fecha_inicio, estado, publicado_at";
  const { data: existing, error } = await supabase
    .from("semanas")
    .select(cols)
    .eq("local_id", localId)
    .eq("fecha_inicio", monday)
    .maybeSingle();
  if (error) throw error;
  if (existing) return { week: existing as WeekRow, isNew: false };

  const { data: created, error: e2 } = await supabase
    .from("semanas")
    .insert({ local_id: localId, fecha_inicio: monday })
    .select(cols)
    .single();
  if (e2) {
    // Dos pestañas a la vez: la otra la creó primero. Volvemos a leer.
    if (e2.code === "23505") return getOrCreateWeek(localId, monday);
    throw e2;
  }
  return { week: created as WeekRow, isNew: true };
}

export async function getWeekGrid(weekId: string, employeeIds: string[]) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("turnos").select("empleado_id, dia, franja").eq("semana_id", weekId);
  if (error) throw error;
  return rowsToGrid(employeeIds, (data ?? []) as TurnoRow[]);
}

export interface PendingRequest {
  id: string;
  tipo: "librar" | "intercambio";
  dia: number;
  mensaje: string | null;
  empleadoId: string;
  conEmpleadoId: string | null;
}

export async function getPendingRequests(weekId: string): Promise<PendingRequest[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("solicitudes")
    .select("id, tipo, dia, mensaje, empleado_id, con_empleado_id")
    .eq("semana_id", weekId)
    .eq("estado", "pendiente")
    .order("created_at");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    tipo: r.tipo,
    dia: r.dia,
    mensaje: r.mensaje,
    empleadoId: r.empleado_id,
    conEmpleadoId: r.con_empleado_id,
  }));
}

export { localToRules };
