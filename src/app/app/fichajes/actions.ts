"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { deliverPush } from "@/lib/push";
import { z } from "zod";
import { addDays, isValidISODate, todayInMadrid } from "@/lib/dates";
import { getClockPeriod, requireLocal } from "@/lib/data/queries";
import { dayStatus, groupByEmployeeDay, madridToIso, type ClockDayRow } from "@/lib/fichajes";
import { shiftTimes } from "@/lib/schedule/rules";
import { timeField } from "@/lib/forms";
import { toHours } from "@/lib/schedule/rules";
import { createClient } from "@/lib/supabase/server";

export type Result = { ok: true } | { ok: false; error: string };

export async function activateClock(): Promise<Result> {
  const { local } = await requireLocal();
  const supabase = await createClient();
  const { error } = await supabase.from("locales").update({ fichaje_activo: true }).eq("id", local.id);
  if (error) return { ok: false, error: "No se ha podido activar el fichaje." };
  revalidatePath("/app", "layout");
  return { ok: true };
}

const reason = z.string().trim().min(2, "Indica el motivo del cambio").max(300, "Motivo demasiado largo");

const clockSchema = z.object({
  id: z.uuid().optional(),
  employeeId: z.uuid(),
  date: z.string().refine(isValidISODate, "Fecha no válida"),
  start: timeField,
  end: timeField.nullable(),
  reason,
});
export type ClockInput = z.input<typeof clockSchema>;

/** Mensajes de la base de datos que se pueden enseñar tal cual. */
const KNOWN = ["motivo", "posterior", "24 horas", "futuras", "solapa", "no encontrado"];

function friendly(message: string): string {
  return KNOWN.some((k) => message.toLowerCase().includes(k)) ? message : "No se ha podido guardar el fichaje.";
}

/**
 * Crea o corrige un tramo. Las horas llegan en hora de Madrid; si la salida
 * es anterior a la entrada, es del día siguiente (turnos de noche).
 */
export async function saveClock(input: ClockInput): Promise<Result> {
  await requireLocal();
  const parsed = clockSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const c = parsed.data;
  const entrada = madridToIso(c.date, c.start);
  const salida = c.end ? madridToIso(toHours(c.end) <= toHours(c.start) ? addDays(c.date, 1) : c.date, c.end) : null;

  const supabase = await createClient();
  const { error } = await supabase.rpc("guardar_fichaje", {
    p_id: c.id ?? null,
    p_empleado: c.employeeId,
    p_entrada: entrada,
    p_salida: salida,
    p_motivo: c.reason,
  });
  if (error) return { ok: false, error: friendly(error.message) };
  revalidatePath("/app", "layout");
  after(() => deliverPush().catch(() => undefined));
  return { ok: true };
}

export async function deleteClock(id: string, why: string): Promise<Result> {
  await requireLocal();
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Fichaje no válido." };
  const r = reason.safeParse(why);
  if (!r.success) return { ok: false, error: r.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.rpc("borrar_fichaje", { p_id: id, p_motivo: r.data });
  if (error) return { ok: false, error: friendly(error.message) };
  revalidatePath("/app", "layout");
  after(() => deliverPush().catch(() => undefined));
  return { ok: true };
}

/** Los datos del mes; el archivo (Excel o CSV, y el modelo) lo monta el navegador. */
export type ExportResult = { ok: true; rows: ClockDayRow[]; month: string; localName: string; fileBase: string; now: string } | { ok: false; error: string };

/** Registro de jornada de un mes en CSV (para Excel o la gestoría). */
export async function exportClock(month: string): Promise<ExportResult> {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return { ok: false, error: "Mes no válido." };
  const { local, employees, roles, shifts, settings } = await requireLocal();
  const first = `${month}-01`;
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const period = await getClockPeriod(first, last);

  const today = todayInMadrid();
  const now = new Date();
  const roleName = Object.fromEntries(roles.map((r) => [r.key, r.name]));
  const people = [
    ...employees.map((e) => ({ id: e.id, name: e.name, role: roleName[e.role] ?? e.role })),
    ...period.archived.map((a) => ({ id: a.id, name: `${a.name} (ya no está)`, role: roleName[a.role] ?? a.role })),
  ];
  const byDay = groupByEmployeeDay(period.records);
  const lastReason = new Map<string, string>();
  for (const ch of period.changes) lastReason.set(ch.recordId, ch.reason);

  const rows: ClockDayRow[] = [];
  for (let date = first; date <= last && date <= today; date = addDays(date, 1)) {
    for (const p of people) {
      const records = byDay.get(`${p.id}|${date}`) ?? [];
      const slot = period.planned.find((x) => x.employeeId === p.id && x.date === date)?.slot;
      const shift = slot ? shifts[slot] : undefined;
      if (!records.length && !shift) continue;
      const status = dayStatus(date, records, shift ?? null, now, settings.clockMarginMinutes);
      const reasonOf = [...records].reverse().find((r) => r.edited && lastReason.has(r.id));
      rows.push({
        date,
        name: p.name,
        role: p.role,
        records,
        planned: shift ? `${shift.label} ${shiftTimes(shift)}` : "",
        plannedHours: shift?.hours ?? 0,
        status: status.kind,
        lastReason: reasonOf ? lastReason.get(reasonOf.id) : undefined,
      });
    }
  }
  const slug = local.nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return { ok: true, rows, month, localName: local.nombre, fileBase: `registro-jornada-${slug || "local"}-${month}`, now: now.toISOString() };
}
