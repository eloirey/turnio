/** Puestos disponibles en el MVP (hostelería). */
export const ROLES = ["sala", "cocina", "barra"] as const;
export type RoleId = (typeof ROLES)[number];

export const ROLE_LABELS: Record<string, string> = { sala: "Sala", cocina: "Cocina", barra: "Barra" };

// Clases completas escritas a mano: Tailwind solo genera las que aparecen literalmente.
export const ROLE_STYLES: Record<string, string> = {
  sala: "bg-sala text-sala-ink",
  cocina: "bg-cocina text-cocina-ink",
  barra: "bg-barra text-barra-ink",
};

export function isRole(value: string): value is RoleId {
  return (ROLES as readonly string[]).includes(value);
}
