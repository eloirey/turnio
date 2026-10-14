import "server-only";
import { headers } from "next/headers";

/**
 * URL pública de la app (para enlaces de email y de WhatsApp).
 * En producción conviene fijar NEXT_PUBLIC_SITE_URL; en local se deduce de la petición.
 */
export async function getBaseUrl(): Promise<string> {
  const fixed = process.env.NEXT_PUBLIC_SITE_URL;
  if (fixed) return fixed.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
