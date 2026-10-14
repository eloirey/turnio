/**
 * Puestos personalizables. Cada local crea los suyos (Sala, Caja,
 * Auxiliares…) con un nombre y un color de esta paleta.
 */

export interface Role {
  /** Identificador estable ("sala", "caja-2"). No cambia aunque se renombre. */
  key: string;
  name: string;
  /** Índice en PALETTE. */
  color: number;
}

/**
 * 10 colores suaves de fondo con su texto oscuro a juego. Todos los pares
 * superan el contraste 4,5:1 recomendado para leer texto.
 */
export const PALETTE: { bg: string; fg: string; name: string }[] = [
  { bg: "#DCE7F5", fg: "#1D3557", name: "Azul" },
  { bg: "#F9DEC9", fg: "#6E2E0B", name: "Naranja" },
  { bg: "#DDEBD3", fg: "#2A4A1C", name: "Verde" },
  { bg: "#EBDDF3", fg: "#4B2763", name: "Lila" },
  { bg: "#F8EBB8", fg: "#5A4300", name: "Amarillo" },
  { bg: "#D3EDEB", fg: "#11524C", name: "Turquesa" },
  { bg: "#F6D5DC", fg: "#6D1D30", name: "Rosa" },
  { bg: "#E6E2D8", fg: "#3E3A30", name: "Arena" },
  { bg: "#D8DEF8", fg: "#26306B", name: "Índigo" },
  { bg: "#E9E0D3", fg: "#5B3A1E", name: "Tierra" },
];

export function roleStyle(color: number | undefined): { backgroundColor: string; color: string } {
  const p = PALETTE[(color ?? 7) % PALETTE.length];
  return { backgroundColor: p.bg, color: p.fg };
}

export function roleMap(roles: Role[]): Record<string, Role> {
  return Object.fromEntries(roles.map((r) => [r.key, r]));
}

/** "Atención al cliente" → "atencion-al-cliente"; si ya existe, añade "-2", "-3"… */
export function makeRoleKey(name: string, existing: string[]): string {
  const base =
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 30) || "puesto";
  let key = base;
  for (let i = 2; existing.includes(key); i++) key = `${base}-${i}`;
  return key;
}
