/**
 * Validación de los formularios del encargado. La usan las acciones del
 * servidor (siempre) y la demo (que no tiene servidor), así los mensajes de
 * error son idénticos en los dos sitios.
 */
import { z } from "zod";
import { shiftHours, shiftSegments, spanHours } from "@/lib/schedule/rules";
import { MAX_SLOTS } from "@/lib/schedule/types";

export const timeField = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora no válida (usa HH:MM)");

// ---------- Necesidades y franjas ----------
const count = z.number().int().min(0).max(50);
const byRole = z.record(z.string().regex(/^[a-z0-9-]{1,40}$/), count);

const shiftInput = z.object({
  code: z.string().regex(/^[A-Za-z0-9]{1,8}$/, "Código de franja no válido").refine((c) => c !== "L", "Código reservado"),
  label: z.string().trim().min(1, "Ponle nombre a cada franja").max(30, "El nombre de una franja puede tener 30 letras como mucho"),
  start: timeField,
  end: timeField,
  /** Turno partido: segundo tramo (los dos o ninguno). */
  start2: timeField.nullish(),
  end2: timeField.nullish(),
  closing: z.boolean(),
});
export type ShiftInput = z.input<typeof shiftInput>;

export const necesidadesSchema = z
  .object({
    demand: z.array(z.record(z.string(), byRole)).length(7),
    shifts: z.array(shiftInput).min(1, "Tiene que haber al menos una franja").max(MAX_SLOTS, `Como mucho ${MAX_SLOTS} franjas`),
  })
  .superRefine((v, ctx) => {
    const codes = new Set<string>();
    const labels = new Set<string>();
    for (const s of v.shifts) {
      if (codes.has(s.code)) ctx.addIssue({ code: "custom", message: "Hay dos franjas con el mismo código" });
      codes.add(s.code);
      const key = s.label.trim().toLowerCase();
      if (labels.has(key)) ctx.addIssue({ code: "custom", message: `Hay dos franjas que se llaman «${s.label.trim()}»` });
      labels.add(key);
      if (Boolean(s.start2) !== Boolean(s.end2)) ctx.addIssue({ code: "custom", message: `Completa el segundo tramo de «${s.label}»` });
      const h = shiftHours(s.start, s.end, s.start2, s.end2);
      if (spanHours(s.start, s.end) < 0.5 || (s.start2 && s.end2 && spanHours(s.start2, s.end2) < 0.5))
        ctx.addIssue({ code: "custom", message: `Cada tramo de «${s.label}» tiene que durar al menos media hora` });
      if (h > 16) ctx.addIssue({ code: "custom", message: `«${s.label}» no puede durar más de 16 horas` });
      if (s.start2 && s.end2) {
        const [a, b] = shiftSegments(s);
        if (b.start - a.end < 0.5) ctx.addIssue({ code: "custom", message: `En «${s.label}», el segundo tramo debe empezar después del primero` });
        if (b.end - a.start > 24) ctx.addIssue({ code: "custom", message: `«${s.label}» no puede ocupar más de 24 horas` });
      }
    }
  });
export type NecesidadesInput = z.input<typeof necesidadesSchema>;

// ---------- Ajustes del local ----------
export const settingsSchema = z.object({
  nombre: z.string().trim().min(1, "Ponle nombre a tu negocio").max(120),
  maxConsecutiveNights: z.number().int().min(1).max(7),
  minRestHours: z.number().int().min(0).max(24),
  minDaysOff: z.number().int().min(0).max(6),
  maxExtraHours: z.number().int().min(0).max(20),
  clockIn: z.boolean(),
  clockMarginMinutes: z.number().int().min(0).max(60),
  clockControl: z.enum(["no", "avisar", "bloquear"]).default("no"),
  clockRadius: z.number().int().min(50).max(2000).default(200),
});
export type SettingsInput = z.input<typeof settingsSchema>;

// ---------- Empleados ----------
export const employeeSchema = z.object({
  id: z.uuid().optional(),
  nombre: z.string().trim().min(1, "Escribe el nombre").max(80),
  puesto: z.string().min(1, "Elige un puesto").max(40),
  horasContrato: z.coerce.number<number>().int("Las horas tienen que ser un número entero").min(1, "Mínimo 1 hora").max(60, "Máximo 60 horas"),
  telefono: z
    .string()
    .trim()
    .max(20)
    .refine((v) => v === "" || /^\+?[\d\s-]{9,15}$/.test(v), "Teléfono no válido")
    .optional(),
  availability: z.record(z.string(), z.array(z.boolean()).length(7)),
  minDaysOff: z.number().int().min(0).max(6).nullable().optional(),
  maxConsecutiveClosings: z.number().int().min(1).max(7).nullable().optional(),
  preferredDaysOff: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  /** Días en que puede fichar desde cualquier sitio (teletrabajo). */
  remoteDays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
});
export type EmployeeInput = z.input<typeof employeeSchema>;

/** Primer mensaje de error de una validación, listo para enseñar. */
export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Revisa los datos.";
}

// ---------- Alta del negocio ----------
const onboardingShift = z
  .object({
    code: z.string().max(8).optional(),
    label: z.string().trim().min(1, "Ponle nombre a cada franja").max(30, "Nombre de franja demasiado largo"),
    start: timeField,
    end: timeField,
  })
  .refine((s) => spanHours(s.start, s.end) >= 0.5 && spanHours(s.start, s.end) <= 16, { message: "Cada franja debe durar entre media hora y 16 horas." });

export const onboardingSchema = z
  .object({
    nombre: z.string().trim().min(1, "Ponle nombre a tu negocio").max(120, "Nombre demasiado largo"),
    tipo: z.string().max(30).default("otro"),
    /** Franjas editadas en el alta. Si no vienen, se usan las de la plantilla. */
    franjas: z
      .array(onboardingShift)
      .min(1, "Deja al menos una franja")
      .max(MAX_SLOTS, `Máximo ${MAX_SLOTS} franjas`)
      .refine((l) => new Set(l.map((f) => f.label.toLowerCase())).size === l.length, { message: "Hay dos franjas con el mismo nombre." })
      .optional(),
    puestos: z
      .array(z.string().trim().max(40, "Nombre de puesto demasiado largo"))
      .transform((l) => l.filter(Boolean))
      .pipe(z.array(z.string()).min(1, "Añade al menos un puesto").max(30, "Máximo 30 puestos")),
  })
  .refine((v) => new Set(v.puestos.map((n) => n.toLowerCase())).size === v.puestos.length, { message: "Hay dos puestos con el mismo nombre." });
export type OnboardingInput = z.input<typeof onboardingSchema>;
