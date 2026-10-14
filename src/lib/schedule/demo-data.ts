import type { Demand, Employee, Slot } from "./types";

/** Convierte "1111100" en [true, true, true, true, true, false, false]. */
const days = (mask: string) => mask.split("").map((c) => c === "1");
const avail = (m: string, t: string, n: string): Record<Slot, boolean[]> => ({ M: days(m), T: days(t), N: days(n) });

/** Plantilla de ejemplo (la misma del prototipo). Solo para la demo y los tests. */
export const DEMO_EMPLOYEES: Employee[] = [
  { id: "marta", name: "Marta", role: "sala", contractHours: 40, availability: avail("1111100", "1111100", "0000000") },
  { id: "jordi", name: "Jordi", role: "cocina", contractHours: 40, availability: avail("1111111", "1111111", "1111111") },
  { id: "laura", name: "Laura", role: "barra", contractHours: 32, availability: avail("0000000", "1111110", "0111110") },
  { id: "aleix", name: "Aleix", role: "sala", contractHours: 20, availability: avail("0000000", "0000011", "1111111") },
  { id: "nuria", name: "Nuria", role: "cocina", contractHours: 32, availability: avail("1111110", "1111110", "1111110") },
  { id: "pol", name: "Pol", role: "barra", contractHours: 16, availability: avail("0000111", "0000111", "0000111") },
  { id: "sara", name: "Sara", role: "sala", contractHours: 16, availability: avail("0000111", "0000111", "0000111") },
];

export const DEMO_DEMAND: Demand = [
  { M: { sala: 1 }, N: { cocina: 1 } }, // lunes
  { M: { sala: 1 }, N: { cocina: 1, barra: 1 } }, // martes
  { M: { sala: 1 }, N: { cocina: 1, barra: 1 } }, // miércoles
  { M: { sala: 1 }, N: { cocina: 1, barra: 1 } }, // jueves
  { M: { sala: 1 }, N: { sala: 1, cocina: 1, barra: 1 } }, // viernes
  { T: { sala: 1, barra: 1 }, N: { sala: 1, cocina: 1, barra: 1 } }, // sábado
  { M: { sala: 1, cocina: 1 } }, // domingo
];

export const ROLE_LABELS: Record<string, string> = { sala: "Sala", cocina: "Cocina", barra: "Barra" };
