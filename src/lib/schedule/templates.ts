/**
 * Plantillas por sector. Cada una trae lo necesario para empezar sin pensar:
 * puestos (con color), franjas con su horario, cuánta gente hace falta cada
 * día y un equipo de ejemplo (para la demo). Todo se puede cambiar después.
 */
import { makeRoleKey, type Role } from "@/lib/roles";
import { spanHours } from "./rules";
import { DAYS_IN_WEEK, type Demand, type Employee, type ShiftCatalog, type Slot } from "./types";

interface ShiftSpec {
  code: string;
  label: string;
  start: string;
  end: string;
  closing?: boolean;
}
/** "role" y "slot" se refieren al índice del puesto y al código de la franja. */
interface NeedSpec {
  role: number;
  slot: string;
  days: number[];
  count: number;
}
interface PersonSpec {
  name: string;
  role: number;
  hours: number;
  /** Franjas que puede hacer (por defecto, todas). */
  slots?: string[];
  /** Días que nunca puede trabajar. */
  off?: number[];
  phone?: string;
}

export interface SectorTemplate {
  key: string;
  label: string;
  /** Una línea para la tarjeta de elección. */
  hint: string;
  roles: { name: string; color: number }[];
  shifts: ShiftSpec[];
  needs: NeedSpec[];
  team: PersonSpec[];
}

const ALL = [0, 1, 2, 3, 4, 5, 6];
const MON_FRI = [0, 1, 2, 3, 4];
const MON_SAT = [0, 1, 2, 3, 4, 5];
const TUE_SUN = [1, 2, 3, 4, 5, 6];
const TUE_SAT = [1, 2, 3, 4, 5];
const WEEKEND = [5, 6];
const FRI_SAT = [4, 5];

const MTN: ShiftSpec[] = [
  { code: "M", label: "Mañana", start: "07:00", end: "15:00" },
  { code: "T", label: "Tarde", start: "15:00", end: "23:00" },
  { code: "N", label: "Noche", start: "23:00", end: "07:00", closing: true },
];

export const SECTOR_TEMPLATES: SectorTemplate[] = [
  {
    key: "bar",
    label: "Bar o restaurante",
    hint: "Sala, cocina y barra",
    roles: [
      { name: "Sala", color: 0 },
      { name: "Cocina", color: 1 },
      { name: "Barra", color: 2 },
    ],
    shifts: [
      { code: "M", label: "Mañana", start: "09:00", end: "17:00" },
      { code: "T", label: "Tarde", start: "13:00", end: "21:00" },
      { code: "N", label: "Noche", start: "17:00", end: "01:00", closing: true },
    ],
    needs: [
      { role: 0, slot: "M", days: ALL, count: 1 },
      { role: 1, slot: "M", days: [4, 5, 6], count: 1 },
      { role: 1, slot: "N", days: ALL, count: 1 },
      { role: 2, slot: "N", days: TUE_SUN, count: 1 },
      { role: 0, slot: "N", days: FRI_SAT, count: 1 },
      { role: 2, slot: "T", days: [5], count: 1 },
    ],
    team: [
      { name: "Marta", role: 0, hours: 40, slots: ["M", "T"], off: WEEKEND, phone: "600111222" },
      { name: "Jordi", role: 1, hours: 40 },
      { name: "Laura", role: 2, hours: 32, slots: ["T", "N"], off: [0] },
      { name: "Aleix", role: 0, hours: 24 },
      { name: "Nuria", role: 1, hours: 32, off: [6] },
      { name: "Pol", role: 2, hours: 24, off: [0, 1, 2, 3] },
      { name: "Toni", role: 1, hours: 24 },
      { name: "Sara", role: 0, hours: 16, off: [0, 1, 2, 3] },
    ],
  },
  {
    key: "cafeteria",
    label: "Cafetería o panadería",
    hint: "Barra y obrador, desde primera hora",
    roles: [
      { name: "Barra", color: 2 },
      { name: "Obrador", color: 4 },
    ],
    shifts: [
      { code: "A", label: "Apertura", start: "06:30", end: "14:30" },
      { code: "T", label: "Tarde", start: "14:00", end: "21:00" },
    ],
    needs: [
      { role: 0, slot: "A", days: ALL, count: 1 },
      { role: 0, slot: "A", days: WEEKEND, count: 1 },
      { role: 1, slot: "A", days: MON_SAT, count: 1 },
      { role: 0, slot: "T", days: ALL, count: 1 },
    ],
    team: [
      { name: "Carmen", role: 0, hours: 40 },
      { name: "Iván", role: 0, hours: 30, slots: ["T"] },
      { name: "Rosa", role: 1, hours: 40, slots: ["A"] },
      { name: "Héctor", role: 0, hours: 24, off: [0, 1, 2] },
      { name: "Lucía", role: 1, hours: 16 },
      { name: "Toni", role: 0, hours: 32 },
    ],
  },
  {
    key: "hotel",
    label: "Hotel o alojamiento",
    hint: "Recepción 24 h, pisos y mantenimiento",
    roles: [
      { name: "Recepción", color: 8 },
      { name: "Pisos", color: 5 },
      { name: "Mantenimiento", color: 7 },
    ],
    shifts: MTN,
    needs: [
      { role: 0, slot: "M", days: ALL, count: 1 },
      { role: 0, slot: "T", days: ALL, count: 1 },
      { role: 0, slot: "N", days: ALL, count: 1 },
      { role: 1, slot: "M", days: ALL, count: 2 },
      { role: 2, slot: "M", days: MON_FRI, count: 1 },
    ],
    team: [
      { name: "Elena", role: 0, hours: 40, slots: ["M", "T"] },
      { name: "David", role: 0, hours: 40 },
      { name: "Miguel", role: 0, hours: 40, slots: ["N"] },
      { name: "Irene", role: 0, hours: 24 },
      { name: "Óscar", role: 0, hours: 24 },
      { name: "Fátima", role: 1, hours: 40, slots: ["M"] },
      { name: "Gloria", role: 1, hours: 40, slots: ["M"] },
      { name: "Yolanda", role: 1, hours: 32, slots: ["M"] },
      { name: "Ramón", role: 2, hours: 40, slots: ["M"] },
    ],
  },
  {
    key: "tienda",
    label: "Tienda o comercio",
    hint: "Dependientes, caja y almacén",
    roles: [
      { name: "Dependientes", color: 6 },
      { name: "Caja", color: 4 },
      { name: "Almacén", color: 7 },
    ],
    shifts: [
      { code: "M", label: "Mañana", start: "09:30", end: "15:00" },
      { code: "T", label: "Tarde", start: "15:00", end: "21:00" },
    ],
    needs: [
      { role: 0, slot: "M", days: MON_SAT, count: 1 },
      { role: 0, slot: "T", days: MON_SAT, count: 1 },
      { role: 0, slot: "T", days: FRI_SAT, count: 1 },
      { role: 1, slot: "M", days: MON_SAT, count: 1 },
      { role: 1, slot: "T", days: MON_SAT, count: 1 },
      { role: 2, slot: "M", days: MON_FRI, count: 1 },
    ],
    team: [
      { name: "Paula", role: 0, hours: 30, off: [6] },
      { name: "Óscar", role: 0, hours: 30, off: [6] },
      { name: "Noelia", role: 0, hours: 24, slots: ["T"], off: [6] },
      { name: "Silvia", role: 1, hours: 30, off: [6] },
      { name: "Nora", role: 1, hours: 30, off: [6] },
      { name: "Adrián", role: 1, hours: 20, off: [6] },
      { name: "Raúl", role: 2, hours: 30, slots: ["M"], off: [5, 6] },
    ],
  },
  {
    key: "super",
    label: "Supermercado",
    hint: "Caja, reposición y frescos",
    roles: [
      { name: "Caja", color: 4 },
      { name: "Reposición", color: 7 },
      { name: "Frescos", color: 5 },
    ],
    shifts: [
      { code: "M", label: "Mañana", start: "07:00", end: "15:00" },
      { code: "T", label: "Tarde", start: "14:00", end: "22:00" },
    ],
    needs: [
      { role: 0, slot: "M", days: MON_SAT, count: 2 },
      { role: 0, slot: "T", days: MON_SAT, count: 1 },
      { role: 0, slot: "T", days: FRI_SAT, count: 1 },
      { role: 1, slot: "M", days: MON_FRI, count: 1 },
      { role: 2, slot: "M", days: MON_SAT, count: 1 },
      { role: 2, slot: "T", days: [4, 5], count: 1 },
    ],
    team: [
      { name: "Inma", role: 0, hours: 40, off: [6] },
      { name: "Sergio", role: 0, hours: 40, off: [6] },
      { name: "Patricia", role: 0, hours: 32, off: [6] },
      { name: "Javi", role: 0, hours: 32, off: [6] },
      { name: "Encarna", role: 0, hours: 20, slots: ["T"], off: [6] },
      { name: "Luis", role: 1, hours: 40, slots: ["M"], off: [6] },
      { name: "Toñi", role: 2, hours: 40, off: [6] },
      { name: "Nacho", role: 2, hours: 24, off: [0, 1, 2, 6] },
    ],
  },
  {
    key: "residencia",
    label: "Residencia o centro de día",
    hint: "Auxiliares y enfermería las 24 horas",
    roles: [
      { name: "Auxiliares", color: 3 },
      { name: "Enfermería", color: 0 },
      { name: "Limpieza", color: 5 },
    ],
    shifts: MTN,
    needs: [
      { role: 0, slot: "M", days: ALL, count: 2 },
      { role: 0, slot: "T", days: ALL, count: 1 },
      { role: 0, slot: "N", days: ALL, count: 1 },
      { role: 1, slot: "M", days: ALL, count: 1 },
      { role: 1, slot: "T", days: [1, 3], count: 1 },
      { role: 2, slot: "M", days: MON_FRI, count: 1 },
    ],
    team: [
      { name: "Montse", role: 0, hours: 40 },
      { name: "Abdel", role: 0, hours: 40 },
      { name: "Pilar", role: 0, hours: 40 },
      { name: "Cristina", role: 0, hours: 40 },
      { name: "Jesús", role: 0, hours: 40, slots: ["N", "T"] },
      { name: "Marisa", role: 0, hours: 32 },
      { name: "Ana", role: 1, hours: 40, slots: ["M", "T"] },
      { name: "Teresa", role: 1, hours: 32, slots: ["M", "T"] },
      { name: "Rocío", role: 2, hours: 40, slots: ["M"] },
    ],
  },
  {
    key: "clinica",
    label: "Clínica o centro médico",
    hint: "Recepción, enfermería y consultas",
    roles: [
      { name: "Recepción", color: 8 },
      { name: "Enfermería", color: 0 },
      { name: "Consultas", color: 3 },
    ],
    shifts: [
      { code: "M", label: "Mañana", start: "08:00", end: "15:00" },
      { code: "T", label: "Tarde", start: "15:00", end: "21:00" },
    ],
    needs: [
      { role: 0, slot: "M", days: MON_SAT, count: 1 },
      { role: 0, slot: "T", days: MON_FRI, count: 1 },
      { role: 1, slot: "M", days: MON_FRI, count: 1 },
      { role: 1, slot: "T", days: MON_FRI, count: 1 },
      { role: 2, slot: "M", days: MON_SAT, count: 1 },
      { role: 2, slot: "T", days: [0, 2, 4], count: 1 },
    ],
    team: [
      { name: "Beatriz", role: 0, hours: 35, off: [6] },
      { name: "Mónica", role: 0, hours: 35, off: [6] },
      { name: "Clara", role: 1, hours: 35, off: [5, 6] },
      { name: "Germán", role: 1, hours: 35, off: [5, 6] },
      { name: "Dra. Soler", role: 2, hours: 35, off: [6] },
      { name: "Dr. Vidal", role: 2, hours: 30, off: [6] },
    ],
  },
  {
    key: "farmacia",
    label: "Farmacia",
    hint: "Mañana, tarde y guardias",
    roles: [
      { name: "Farmacéuticos", color: 2 },
      { name: "Técnicos", color: 5 },
    ],
    shifts: [
      { code: "M", label: "Mañana", start: "09:00", end: "14:00" },
      { code: "T", label: "Tarde", start: "16:30", end: "21:00" },
      { code: "G", label: "Guardia", start: "21:00", end: "09:00", closing: true },
    ],
    needs: [
      { role: 0, slot: "M", days: MON_SAT, count: 1 },
      { role: 0, slot: "T", days: MON_FRI, count: 1 },
      { role: 1, slot: "M", days: MON_SAT, count: 1 },
      { role: 1, slot: "T", days: [0, 1, 2, 3], count: 1 },
      { role: 0, slot: "G", days: [5], count: 1 },
    ],
    team: [
      { name: "Mercè", role: 0, hours: 40 },
      { name: "Alberto", role: 0, hours: 30 },
      { name: "Jaume", role: 0, hours: 25 },
      { name: "Judit", role: 1, hours: 40, slots: ["M", "T"], off: [6] },
      { name: "Eva", role: 1, hours: 24, slots: ["M", "T"], off: [6] },
    ],
  },
  {
    key: "gimnasio",
    label: "Gimnasio o centro deportivo",
    hint: "Recepción, monitores y limpieza",
    roles: [
      { name: "Recepción", color: 8 },
      { name: "Monitores", color: 1 },
      { name: "Limpieza", color: 5 },
    ],
    shifts: [
      { code: "M", label: "Mañana", start: "07:00", end: "15:00" },
      { code: "T", label: "Tarde", start: "15:00", end: "23:00" },
    ],
    needs: [
      { role: 0, slot: "M", days: ALL, count: 1 },
      { role: 0, slot: "T", days: ALL, count: 1 },
      { role: 1, slot: "M", days: ALL, count: 1 },
      { role: 1, slot: "T", days: MON_FRI, count: 1 },
      { role: 1, slot: "T", days: [0, 2], count: 1 },
      { role: 2, slot: "M", days: MON_FRI, count: 1 },
    ],
    team: [
      { name: "Álex", role: 0, hours: 40 },
      { name: "Lorena", role: 0, hours: 40 },
      { name: "Celia", role: 0, hours: 40 },
      { name: "Marc", role: 1, hours: 40 },
      { name: "Bruno", role: 1, hours: 40, slots: ["T"] },
      { name: "Sofía", role: 1, hours: 25 },
      { name: "Edu", role: 1, hours: 20, slots: ["T"], off: WEEKEND },
      { name: "Juani", role: 2, hours: 40, slots: ["M"] },
    ],
  },
  {
    key: "peluqueria",
    label: "Peluquería o estética",
    hint: "De martes a sábado",
    roles: [
      { name: "Estilistas", color: 6 },
      { name: "Recepción", color: 8 },
    ],
    shifts: [
      { code: "M", label: "Mañana", start: "09:00", end: "15:00" },
      { code: "T", label: "Tarde", start: "14:00", end: "20:00" },
    ],
    needs: [
      { role: 0, slot: "M", days: TUE_SAT, count: 2 },
      { role: 0, slot: "T", days: TUE_SAT, count: 2 },
      { role: 1, slot: "M", days: TUE_SAT, count: 1 },
    ],
    team: [
      { name: "Vanesa", role: 0, hours: 40, off: [0, 6] },
      { name: "Raquel", role: 0, hours: 40, off: [0, 6] },
      { name: "Kevin", role: 0, hours: 30, off: [0, 6] },
      { name: "Alba", role: 0, hours: 30, off: [0, 6] },
      { name: "Susana", role: 1, hours: 30, off: [0, 6] },
    ],
  },
  {
    key: "limpieza",
    label: "Empresa de limpieza",
    hint: "Madrugada, tarde y noche",
    roles: [
      { name: "Limpieza", color: 5 },
      { name: "Supervisión", color: 3 },
    ],
    shifts: [
      { code: "MA", label: "Madrugada", start: "05:00", end: "09:00" },
      { code: "M", label: "Mañana", start: "08:00", end: "14:00" },
      { code: "T", label: "Tarde", start: "15:00", end: "21:00" },
      { code: "N", label: "Noche", start: "22:00", end: "06:00", closing: true },
    ],
    needs: [
      { role: 0, slot: "MA", days: MON_SAT, count: 2 },
      { role: 0, slot: "T", days: MON_FRI, count: 2 },
      { role: 0, slot: "N", days: [4], count: 1 },
      { role: 1, slot: "M", days: MON_FRI, count: 1 },
    ],
    team: [
      { name: "Dolores", role: 0, hours: 30 },
      { name: "Wilson", role: 0, hours: 30 },
      { name: "Amparo", role: 0, hours: 24 },
      { name: "Nicolás", role: 0, hours: 30, slots: ["T", "N"] },
      { name: "Ximena", role: 0, hours: 30, slots: ["T", "N"] },
      { name: "Paco", role: 1, hours: 30, slots: ["M"] },
    ],
  },
  {
    key: "seguridad",
    label: "Seguridad y vigilancia",
    hint: "Turnos de 12 horas, día y noche",
    roles: [{ name: "Vigilantes", color: 8 }],
    shifts: [
      { code: "D", label: "Día", start: "07:00", end: "19:00" },
      { code: "N", label: "Noche", start: "19:00", end: "07:00", closing: true },
    ],
    needs: [
      { role: 0, slot: "D", days: ALL, count: 1 },
      { role: 0, slot: "N", days: ALL, count: 1 },
    ],
    team: [
      { name: "Fernando", role: 0, hours: 40 },
      { name: "Rubén", role: 0, hours: 40 },
      { name: "Antonio", role: 0, hours: 40 },
      { name: "Jessica", role: 0, hours: 40 },
      { name: "Manolo", role: 0, hours: 24 },
    ],
  },
  {
    key: "logistica",
    label: "Almacén o logística",
    hint: "Tres turnos de lunes a viernes",
    roles: [
      { name: "Mozos", color: 7 },
      { name: "Carretilleros", color: 4 },
      { name: "Jefe de turno", color: 0 },
    ],
    shifts: [
      { code: "M", label: "Mañana", start: "06:00", end: "14:00" },
      { code: "T", label: "Tarde", start: "14:00", end: "22:00" },
      { code: "N", label: "Noche", start: "22:00", end: "06:00", closing: true },
    ],
    needs: [
      { role: 0, slot: "M", days: MON_FRI, count: 2 },
      { role: 0, slot: "T", days: MON_FRI, count: 2 },
      { role: 0, slot: "N", days: [0, 1, 2, 3], count: 1 },
      { role: 1, slot: "M", days: MON_FRI, count: 1 },
      { role: 1, slot: "T", days: MON_FRI, count: 1 },
      { role: 2, slot: "M", days: MON_FRI, count: 1 },
      { role: 2, slot: "T", days: MON_FRI, count: 1 },
    ],
    team: [
      { name: "Kike", role: 0, hours: 40, off: WEEKEND },
      { name: "Mohamed", role: 0, hours: 40, off: WEEKEND },
      { name: "Iker", role: 0, hours: 40, off: WEEKEND },
      { name: "Lidia", role: 0, hours: 40, off: WEEKEND },
      { name: "Óliver", role: 0, hours: 40, slots: ["N", "T"], off: WEEKEND },
      { name: "Gabriel", role: 1, hours: 40, off: WEEKEND },
      { name: "Marina", role: 1, hours: 40, off: WEEKEND },
      { name: "Víctor", role: 2, hours: 40, off: WEEKEND },
      { name: "Elisa", role: 2, hours: 40, off: WEEKEND },
    ],
  },
  {
    key: "transporte",
    label: "Transporte de viajeros",
    hint: "Franjas con el nombre de cada línea",
    roles: [
      { name: "Conductores", color: 0 },
      { name: "Tráfico", color: 4 },
    ],
    shifts: [
      { code: "L12M", label: "Línea 12 · mañana", start: "06:00", end: "14:00" },
      { code: "L12T", label: "Línea 12 · tarde", start: "14:00", end: "22:00" },
      { code: "L7M", label: "Línea 7 · mañana", start: "06:30", end: "14:30" },
      { code: "BUHO", label: "Búho nocturno", start: "22:30", end: "06:30", closing: true },
    ],
    needs: [
      { role: 0, slot: "L12M", days: ALL, count: 1 },
      { role: 0, slot: "L12T", days: ALL, count: 1 },
      { role: 0, slot: "L7M", days: MON_FRI, count: 1 },
      { role: 0, slot: "BUHO", days: [4, 5], count: 1 },
      { role: 1, slot: "L12M", days: MON_FRI, count: 1 },
    ],
    team: [
      { name: "Andrés", role: 0, hours: 40 },
      { name: "Berta", role: 0, hours: 40 },
      { name: "Ginés", role: 0, hours: 40 },
      { name: "Lola", role: 0, hours: 30, slots: ["L12T", "BUHO"] },
      { name: "Rafa", role: 0, hours: 24 },
      { name: "Julián", role: 1, hours: 40, off: WEEKEND },
    ],
  },
  {
    key: "atencion",
    label: "Atención al cliente",
    hint: "Agentes y coordinación",
    roles: [
      { name: "Agentes", color: 8 },
      { name: "Coordinación", color: 3 },
    ],
    shifts: [
      { code: "M", label: "Mañana", start: "08:00", end: "15:00" },
      { code: "T", label: "Tarde", start: "15:00", end: "22:00" },
    ],
    needs: [
      { role: 0, slot: "M", days: MON_FRI, count: 2 },
      { role: 0, slot: "T", days: MON_FRI, count: 2 },
      { role: 0, slot: "M", days: [5], count: 1 },
      { role: 1, slot: "M", days: MON_FRI, count: 1 },
    ],
    team: [
      { name: "Andrea", role: 0, hours: 35 },
      { name: "Pablo", role: 0, hours: 35 },
      { name: "Nerea", role: 0, hours: 35 },
      { name: "Hugo", role: 0, hours: 30, slots: ["T"] },
      { name: "Samuel", role: 0, hours: 25 },
      { name: "Ingrid", role: 1, hours: 35, slots: ["M"], off: WEEKEND },
    ],
  },
  {
    key: "ocio",
    label: "Cine u ocio",
    hint: "Tardes y fines de semana",
    roles: [
      { name: "Taquilla", color: 6 },
      { name: "Bar", color: 1 },
      { name: "Sala", color: 0 },
    ],
    shifts: [
      { code: "F", label: "Matinal", start: "10:30", end: "16:30" },
      { code: "T", label: "Tarde", start: "16:00", end: "00:00", closing: true },
    ],
    needs: [
      { role: 0, slot: "T", days: ALL, count: 1 },
      { role: 1, slot: "T", days: ALL, count: 1 },
      { role: 2, slot: "T", days: [4, 5, 6], count: 1 },
      { role: 0, slot: "F", days: WEEKEND, count: 1 },
      { role: 1, slot: "F", days: WEEKEND, count: 1 },
    ],
    team: [
      { name: "Irene", role: 0, hours: 30 },
      { name: "Dani", role: 0, hours: 24 },
      { name: "Paola", role: 1, hours: 30 },
      { name: "Unai", role: 1, hours: 24 },
      { name: "Leo", role: 2, hours: 24 },
      { name: "Rita", role: 0, hours: 24 },
      { name: "Mar", role: 1, hours: 24 },
    ],
  },
  {
    key: "otro",
    label: "Otro tipo de negocio",
    hint: "Empieza con mañana, tarde y noche",
    roles: [{ name: "Equipo", color: 0 }],
    shifts: [
      { code: "M", label: "Mañana", start: "09:00", end: "17:00" },
      { code: "T", label: "Tarde", start: "13:00", end: "21:00" },
      { code: "N", label: "Noche", start: "17:00", end: "01:00", closing: true },
    ],
    needs: [
      { role: 0, slot: "M", days: MON_FRI, count: 1 },
      { role: 0, slot: "T", days: MON_FRI, count: 1 },
    ],
    team: [
      { name: "Persona 1", role: 0, hours: 40 },
      { name: "Persona 2", role: 0, hours: 40 },
      { name: "Persona 3", role: 0, hours: 20 },
    ],
  },
];

export function getTemplate(key: string): SectorTemplate {
  return SECTOR_TEMPLATES.find((t) => t.key === key) ?? SECTOR_TEMPLATES[SECTOR_TEMPLATES.length - 1];
}

/** Franjas de la plantilla como catálogo (horas calculadas desde el horario). */
export function templateShifts(t: SectorTemplate): ShiftCatalog {
  return Object.fromEntries(
    t.shifts.map((s, i) => [
      s.code,
      { code: s.code, label: s.label, start: s.start, end: s.end, hours: spanHours(s.start, s.end), closing: Boolean(s.closing), order: i, active: true },
    ]),
  );
}

/** Puestos de la plantilla. Si se pasan nombres propios, se usan esos (en el mismo orden). */
export function templateRoles(t: SectorTemplate, names?: string[]): Role[] {
  const list = names ?? t.roles.map((r) => r.name);
  const keys: string[] = [];
  return list.map((name, i) => {
    const key = makeRoleKey(name, keys);
    keys.push(key);
    return { key, name, color: t.roles[i]?.color ?? (i + 6) % 10 };
  });
}

/**
 * Necesidades de la plantilla para unos puestos dados. Si el encargado
 * quitó o añadió puestos, los que no existen en la plantilla reciben
 * 1 persona por la mañana (la primera franja) de lunes a viernes.
 */
export function templateDemand(t: SectorTemplate, roles: Role[]): Demand {
  const demand: Demand = Array.from({ length: DAYS_IN_WEEK }, () => ({}));
  const add = (day: number, slot: Slot, role: string, count: number) => {
    const d = (demand[day][slot] ??= {});
    d[role] = (d[role] ?? 0) + count;
  };
  roles.forEach((role, i) => {
    const specs = t.needs.filter((n) => n.role === i);
    if (i < t.roles.length && specs.length) {
      for (const n of specs) for (const day of n.days) add(day, n.slot, role.key, n.count);
    } else {
      for (const day of MON_FRI) add(day, t.shifts[0].code, role.key, 1);
    }
  });
  return demand;
}

/** Equipo de ejemplo de la plantilla (para la demo). */
export function templateTeam(t: SectorTemplate, roles: Role[]): (Employee & { phone: string | null })[] {
  const codes = t.shifts.map((s) => s.code);
  return t.team
    .filter((p) => roles[p.role])
    .map((p, i) => ({
      id: `demo-${i + 1}`,
      name: p.name,
      role: roles[p.role].key,
      contractHours: p.hours,
      phone: p.phone ?? null,
      availability: Object.fromEntries(
        codes.map((c) => [c, Array.from({ length: DAYS_IN_WEEK }, (_, d) => (!p.slots || p.slots.includes(c)) && !p.off?.includes(d))]),
      ),
      preferredDaysOff: [],
    }));
}
