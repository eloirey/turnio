/** Avisos de la campanita (encargado y empleados). */

export type AvisoTipo = "solicitud" | "solicitud_resuelta" | "horario" | "fichaje" | "anuncio";

export interface Aviso {
  id: string;
  tipo: AvisoTipo;
  titulo: string;
  cuerpo: string | null;
  enlace: string | null;
  creadoEn: string;
  leido: boolean;
  /** Pide hacer algo (una solicitud, un olvido de fichaje…). */
  accion: boolean;
  /** Cómo se resolvió («Aceptada», «Corregido», «Hecho»…) o null si sigue pendiente. */
  resuelto: string | null;
}

export interface AvisoRow {
  id: string;
  tipo: AvisoTipo;
  titulo: string;
  cuerpo: string | null;
  enlace: string | null;
  creado_en: string;
  leido_en: string | null;
  ref_tipo?: string | null;
  resuelto?: string | null;
}

export const AVISO_COLUMNS = "id, tipo, titulo, cuerpo, enlace, creado_en, leido_en, ref_tipo, resuelto";

export function toAvisos(rows: AvisoRow[]): Aviso[] {
  return rows.map((r) => ({
    id: r.id,
    tipo: r.tipo,
    titulo: r.titulo,
    cuerpo: r.cuerpo,
    enlace: r.enlace,
    creadoEn: r.creado_en,
    leido: r.leido_en !== null,
    accion: Boolean(r.ref_tipo),
    resuelto: r.resuelto ?? null,
  }));
}

/** Pide a la campanita que se actualice ya (p. ej. tras aceptar una solicitud). */
export const AVISOS_EVENT = "rotafy:avisos";
export function refreshAvisos(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(AVISOS_EVENT));
}

/** «ahora», «hace 5 min», «hace 3 h», «ayer», «hace 4 días», «12 oct». */
export function timeAgo(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - Date.parse(iso));
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "ayer";
  if (d < 7) return `hace ${d} días`;
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: "Europe/Madrid" }).format(new Date(iso)).replace(".", "");
}

/** Solo enlaces internos de la app (los anuncios podrían traer otros). */
export function safeAvisoLink(enlace: string | null): string | null {
  if (!enlace) return null;
  if (enlace.startsWith("/") && !enlace.startsWith("//")) return enlace;
  return /^https:\/\//.test(enlace) ? enlace : null;
}
