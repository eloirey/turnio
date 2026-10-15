/**
 * ¿Dónde está quien ficha? Se compara su posición (o la wifi) con la del
 * local. Solo se guarda el resultado y la distancia aproximada, nunca las
 * coordenadas.
 */
import type { ClockPlace } from "@/lib/fichajes";
import type { ClockControl } from "@/lib/data/mappers";

export interface LocalPlaceConfig {
  control: ClockControl;
  lat: number | null;
  lng: number | null;
  radius: number;
  ips: string[];
}

export interface Position {
  lat: number;
  lng: number;
  /** Precisión del móvil en metros. */
  accuracy?: number | null;
}

export interface PlaceCheck {
  /** null = este local no comprueba nada (no se guarda). */
  place: ClockPlace | null;
  distance: number | null;
  /** Modo «solo en el local» y no está: no puede fichar. */
  blocked: boolean;
}

/** Distancia en metros entre dos puntos (fórmula del haversine). */
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

/** ¿Este local comprueba algo? (sin ubicación ni wifi guardadas no hay con qué comparar) */
export function checksPlace(c: LocalPlaceConfig): boolean {
  return c.control !== "no" && ((c.lat !== null && c.lng !== null) || c.ips.length > 0);
}

export function checkPlace(config: LocalPlaceConfig, opts: { position?: Position | null; ip?: string | null; remoteToday?: boolean }): PlaceCheck {
  if (!checksPlace(config)) return { place: null, distance: null, blocked: false };
  if (opts.remoteToday) return { place: "teletrabajo", distance: null, blocked: false };
  if (opts.ip && config.ips.includes(opts.ip)) return { place: "local", distance: null, blocked: false };

  const pos = opts.position;
  if (config.lat === null || config.lng === null || !pos || !Number.isFinite(pos.lat) || !Number.isFinite(pos.lng)) {
    return { place: "sin_datos", distance: null, blocked: config.control === "bloquear" };
  }
  const distance = distanceMeters({ lat: config.lat, lng: config.lng }, pos);
  // Se da por buena la imprecisión del GPS (hasta 100 m de margen).
  const slack = Math.min(Math.max(pos.accuracy ?? 0, 0), 100);
  if (distance - slack <= config.radius) return { place: "local", distance, blocked: false };
  return { place: "fuera", distance, blocked: config.control === "bloquear" };
}

/** Día de la semana en Madrid (0 = lunes). */
export function madridWeekday(now = new Date()): number {
  const d = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", weekday: "short" }).format(now);
  return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(d);
}
