import { DAYS_IN_WEEK, type Demand } from "./types";

/**
 * Plantilla inicial de necesidades para que el encargado no empiece de cero:
 * 1 persona por puesto en mañana y noche todos los días, y una más en sala y
 * barra las noches de viernes y sábado. Luego la ajusta en "Necesidades".
 */
export function starterDemand(roles: string[]): Demand {
  return Array.from({ length: DAYS_IN_WEEK }, (_, day) => {
    const weekendNight = day === 4 || day === 5;
    const morning: Record<string, number> = {};
    const night: Record<string, number> = {};
    for (const role of roles) {
      morning[role] = 1;
      night[role] = weekendNight && (role === "sala" || role === "barra") ? 2 : 1;
    }
    return roles.length ? { M: morning, N: night } : {};
  });
}
