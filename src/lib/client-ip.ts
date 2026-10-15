import { headers } from "next/headers";

/** IP pública de quien hace la petición (en Netlify, la cabecera de la conexión). */
export async function clientIp(): Promise<string | null> {
  const h = await headers();
  const raw = h.get("x-nf-client-connection-ip") ?? h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip");
  const ip = raw?.trim();
  if (!ip || ip.length > 45 || !/^[0-9a-fA-F:.]+$/.test(ip)) return null;
  return ip;
}
