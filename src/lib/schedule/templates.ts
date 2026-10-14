import { DAYS_IN_WEEK, type Demand } from "./types";

/**
 * Plantilla inicial de necesidades para no empezar de cero: 1 persona por
 * puesto en mañana y noche todos los días, y una más del primer puesto las
 * noches de viernes y sábado. Luego el encargado la ajusta en "Necesidades".
 */
export function starterDemand(roles: string[]): Demand {
  return Array.from({ length: DAYS_IN_WEEK }, (_, day) => {
    if (!roles.length) return {};
    const weekendNight = day === 4 || day === 5;
    const morning: Record<string, number> = {};
    const night: Record<string, number> = {};
    roles.forEach((role, i) => {
      morning[role] = 1;
      night[role] = weekendNight && i === 0 ? 2 : 1;
    });
    return { M: morning, N: night };
  });
}

/** Puestos sugeridos según el tipo de negocio (el encargado puede cambiarlos). */
export const ROLE_PRESETS: Record<string, { label: string; roles: string[] }> = {
  hosteleria: { label: "Bar o restaurante", roles: ["Sala", "Cocina", "Barra"] },
  tienda: { label: "Tienda o comercio", roles: ["Caja", "Reposición", "Atención al cliente"] },
  residencia: { label: "Residencia o centro de día", roles: ["Auxiliares", "Enfermería", "Limpieza"] },
  gimnasio: { label: "Gimnasio o club", roles: ["Recepción", "Monitores", "Mantenimiento"] },
  otro: { label: "Otro tipo de negocio", roles: ["Equipo"] },
};
