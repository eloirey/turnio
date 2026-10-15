"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { gridToTurnos, type TurnoRow } from "@/lib/data/mappers";
import { requireUser } from "@/lib/data/queries";
import type { Grid } from "@/lib/schedule/types";
import { createClient } from "@/lib/supabase/server";

/*
 * Todas estas acciones solo comprueban la sesión (sin ir a la red) y hacen
 * UNA llamada a la base de datos. La seguridad la garantiza RLS: aunque
 * alguien enviara el id de una semana ajena, la base de datos no la vería.
 */

export type Result = { ok: true } | { ok: false; error: string };
export type TurnosResult = { ok: true; turnos: TurnoRow[] } | { ok: false; error: string };

const uuid = z.uuid();
// Cada casilla es "L" (libre) o el código de una franja del local.
const gridSchema = z.record(z.uuid(), z.array(z.string().regex(/^[A-Za-z0-9]{1,8}$/)).length(7));

/** Autoguardado: sustituye los turnos de la semana (operación atómica en SQL). */
export async function saveWeek(weekId: string, grid: Grid): Promise<Result> {
  await requireUser();
  if (!uuid.safeParse(weekId).success) return { ok: false, error: "Semana no válida." };
  const parsed = gridSchema.safeParse(grid);
  if (!parsed.success) return { ok: false, error: "Cuadrante no válido." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("guardar_cuadrante", {
    p_semana: weekId,
    p_turnos: gridToTurnos(parsed.data as Grid),
  });
  if (error) return { ok: false, error: "No se ha podido guardar." };
  return { ok: true };
}

export async function publishWeek(weekId: string): Promise<Result> {
  await requireUser();
  if (!uuid.safeParse(weekId).success) return { ok: false, error: "Semana no válida." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("publicar_semana", { p_semana: weekId });
  if (error) return { ok: false, error: "No se ha podido publicar." };
  revalidatePath("/app/cuadrante");
  return { ok: true };
}

export async function copyPreviousWeek(weekId: string): Promise<TurnosResult> {
  await requireUser();
  if (!uuid.safeParse(weekId).success) return { ok: false, error: "Semana no válida." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("copiar_semana_anterior", { p_semana: weekId });
  if (error) {
    return { ok: false, error: error.message.includes("vacía") ? "La semana anterior está vacía." : "No se ha podido copiar." };
  }
  return { ok: true, turnos: (data ?? []) as TurnoRow[] };
}

export async function acceptRequest(weekId: string, requestId: string): Promise<TurnosResult> {
  await requireUser();
  if (!uuid.safeParse(requestId).success || !uuid.safeParse(weekId).success) return { ok: false, error: "Solicitud no válida." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("aceptar_solicitud", { p_id: requestId });
  if (error) return { ok: false, error: "No se ha podido aceptar (quizá ya estaba resuelta)." };

  const { data, error: e2 } = await supabase.from("turnos").select("empleado_id, dia, franja").eq("semana_id", weekId);
  if (e2) return { ok: false, error: "Aceptada, pero no se ha podido recargar el cuadrante." };
  return { ok: true, turnos: (data ?? []) as TurnoRow[] };
}

export async function rejectRequest(requestId: string): Promise<Result> {
  await requireUser();
  if (!uuid.safeParse(requestId).success) return { ok: false, error: "Solicitud no válida." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("solicitudes")
    .update({ estado: "rechazada" })
    .eq("id", requestId)
    .eq("estado", "pendiente");
  if (error) return { ok: false, error: "No se ha podido rechazar." };
  return { ok: true };
}
