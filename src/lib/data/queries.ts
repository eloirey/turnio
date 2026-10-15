import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { Role } from "@/lib/roles";
import type { ClockChange, ClockRecord } from "@/lib/fichajes";
import { activeSlots, type AbsenceMap, type Demand, type Grid, type Rules, type ShiftCatalog } from "@/lib/schedule/types";
import { createClient } from "@/lib/supabase/server";
import {
  absencesForWeek,
  franjasToCatalog,
  localToRules,
  localToSettings,
  rowsToDemand,
  rowsToGrid,
  toEmployees,
  toRoles,
  type AusenciaRow,
  type DemandaRow,
  type DisponibilidadRow,
  type EmpleadoRow,
  type EmployeeRecord,
  type FranjaRow,
  type LocalRow,
  type LocalSettings,
  type PuestoRow,
  toClockRecords,
  type FichajeRow,
  type TurnoRow,
} from "./mappers";


/**
 * Lecturas del encargado. Todas usan el cliente con su sesión, así que la
 * base de datos solo devuelve filas de SUS locales (RLS).
 *
 * Rendimiento: cada pantalla hace UNA llamada a la base de datos (funciones
 * cargar_local / cargar_semana) y `cache()` evita repetirla si el layout y la
 * página la piden en la misma petición. Importa porque el servidor puede
 * estar lejos de la base de datos.
 */

/** Usuario de la sesión (verifica el token; con claves asimétricas, sin ir a la red). */
const getUserId = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return (data?.claims?.sub as string | undefined) ?? null;
});

export async function requireUser(): Promise<string> {
  const id = await getUserId();
  if (!id) redirect("/login");
  return id;
}

export interface LocalBundle {
  local: LocalRow;
  rules: Rules;
  settings: LocalSettings;
  roles: Role[];
  employees: EmployeeRecord[];
  demand: Demand;
  shifts: ShiftCatalog;
}

interface CargarLocal {
  local: LocalRow;
  puestos: PuestoRow[];
  empleados: (EmpleadoRow & { disponibilidad: DisponibilidadRow[] })[];
  demanda: DemandaRow[];
  franjas: FranjaRow[];
}

/** Todo lo del local en una consulta (o null si aún no ha creado ninguno). */
export const getLocalBundle = cache(async (): Promise<LocalBundle | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cargar_local");
  if (error) throw error;
  if (!data) return null;
  const d = data as CargarLocal;
  const shifts = franjasToCatalog(d.franjas);
  return {
    local: d.local,
    rules: localToRules(d.local),
    settings: localToSettings(d.local),
    roles: toRoles(d.puestos),
    employees: toEmployees(
      d.empleados,
      d.empleados.flatMap((e) => e.disponibilidad),
      activeSlots(shifts),
    ),
    demand: rowsToDemand(d.demanda),
    shifts,
  };
});

/** Usuario con sesión y con local creado; si no, lo manda donde toca. */
export async function requireLocal(): Promise<LocalBundle> {
  await requireUser();
  const bundle = await getLocalBundle();
  if (!bundle) redirect("/bienvenida");
  return bundle;
}

export type WeekStatus = "borrador" | "publicado" | "cambios";

export interface PendingRequest {
  id: string;
  tipo: "librar" | "intercambio";
  dia: number;
  mensaje: string | null;
  empleadoId: string;
  conEmpleadoId: string | null;
}

export interface WeekData {
  id: string;
  status: WeekStatus;
  publishedAt: string | null;
  turnos: TurnoRow[];
  requests: PendingRequest[];
  absenceRows: AusenciaRow[];
  clock: ClockRecord[];
  previousWeekHasShifts: boolean;
  anyPublished: boolean;
}

interface CargarSemana {
  semana: { id: string; fecha_inicio: string; estado: WeekStatus; publicado_at: string | null };
  turnos: TurnoRow[];
  solicitudes: { id: string; tipo: "librar" | "intercambio"; dia: number; mensaje: string | null; empleado_id: string; con_empleado_id: string | null }[];
  ausencias: AusenciaRow[];
  fichajes?: FichajeRow[];
  semana_anterior_con_turnos: boolean;
  alguna_publicada: boolean;
}

/** Todo lo de una semana en una consulta (la crea vacía si no existe). */
export async function getWeekData(monday: string): Promise<WeekData | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cargar_semana", { p_lunes: monday });
  if (error) throw error;
  if (!data) return null;
  const d = data as CargarSemana;
  return {
    id: d.semana.id,
    status: d.semana.estado,
    publishedAt: d.semana.publicado_at,
    turnos: d.turnos,
    requests: d.solicitudes.map((s) => ({
      id: s.id,
      tipo: s.tipo,
      dia: s.dia,
      mensaje: s.mensaje,
      empleadoId: s.empleado_id,
      conEmpleadoId: s.con_empleado_id,
    })),
    absenceRows: d.ausencias,
    clock: toClockRecords(d.fichajes ?? []),
    previousWeekHasShifts: d.semana_anterior_con_turnos,
    anyPublished: d.alguna_publicada,
  };
}

export function weekGrid(week: WeekData, employeeIds: string[]): Grid {
  return rowsToGrid(employeeIds, week.turnos);
}

export function weekAbsences(week: WeekData, monday: string): AbsenceMap {
  return absencesForWeek(week.absenceRows, monday);
}

/** Ausencias de hoy en adelante, para la ficha de cada empleado. */
export async function getUpcomingAbsences(fromISO: string): Promise<AusenciaRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ausencias")
    .select("id, empleado_id, desde, hasta, motivo, nota")
    .gte("hasta", fromISO)
    .order("desde");
  if (error) throw error;
  return (data ?? []) as AusenciaRow[];
}

export interface ClockPeriod {
  records: ClockRecord[];
  /** Turnos previstos con su fecha. */
  planned: { employeeId: string; date: string; slot: string }[];
  /** Personas que ya no están en el equipo pero ficharon en el periodo. */
  archived: { id: string; name: string; role: string }[];
  changes: ClockChange[];
}

/** Fichajes, turnos previstos e historial de cambios entre dos fechas (incluidas). */
export async function getClockPeriod(from: string, to: string): Promise<ClockPeriod> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cargar_fichajes", { p_desde: from, p_hasta: to });
  if (error) throw error;
  const d = (data ?? { fichajes: [], turnos: [], archivados: [], cambios: [] }) as {
    fichajes: FichajeRow[];
    turnos: { empleado_id: string; fecha: string; franja: string }[];
    archivados: { id: string; nombre: string; puesto: string }[];
    cambios: { fichaje_id: string; empleado_id: string; accion: ClockChange["action"]; antes: ClockChange["before"]; despues: ClockChange["after"]; motivo: string; fecha: string }[];
  };
  return {
    records: toClockRecords(d.fichajes),
    planned: d.turnos.map((t) => ({ employeeId: t.empleado_id, date: t.fecha, slot: t.franja })),
    archived: d.archivados.map((a) => ({ id: a.id, name: a.nombre, role: a.puesto })),
    changes: d.cambios.map((c) => ({
      recordId: c.fichaje_id,
      employeeId: c.empleado_id,
      action: c.accion,
      before: c.antes,
      after: c.despues,
      reason: c.motivo,
      at: c.fecha,
    })),
  };
}
