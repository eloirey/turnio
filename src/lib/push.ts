import "server-only";
import webpush from "web-push";
import { z } from "zod";
import { employeePath } from "@/lib/employee-link";
import { getBaseUrl } from "@/lib/url";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Avisos en el móvil (Web Push). Es gratis: los navegadores entregan los
 * mensajes con sus propios servicios. Hacen falta unas claves VAPID en las
 * variables de entorno (ver README); sin ellas, simplemente no se mandan.
 */

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const SUBJECT = process.env.VAPID_SUBJECT || "mailto:hola@rotafy.es";

const pushConfigured = () => Boolean(PUBLIC_KEY && PRIVATE_KEY);

let configured = false;
function setup() {
  if (configured || !pushConfigured()) return;
  webpush.setVapidDetails(SUBJECT, PUBLIC_KEY!, PRIVATE_KEY!);
  configured = true;
}

interface AvisoPush {
  id: string;
  local_id: string;
  empleado_id: string | null;
  tipo: string;
  titulo: string;
  cuerpo: string | null;
  enlace: string | null;
}

interface Sub {
  id: string;
  local_id: string;
  empleado_id: string | null;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Lo que verá la persona en la notificación. */
function pushPayload(a: Pick<AvisoPush, "titulo" | "cuerpo" | "tipo" | "id">, url: string): string {
  return JSON.stringify({ title: a.titulo, body: a.cuerpo ?? "", url, tag: `${a.tipo}-${a.id}` });
}

/**
 * Manda al móvil los avisos nuevos (cada uno una sola vez, aunque se llame
 * desde varios sitios a la vez). Se llama después de cada acción que puede
 * crear avisos y cuando la campanita mira si hay algo nuevo.
 */
export async function deliverPush(): Promise<number> {
  if (!pushConfigured()) return 0;
  setup();
  const db = createAdminClient();
  const { data, error } = await db.rpc("tomar_avisos_push", { p_limite: 100 });
  if (error || !data?.length) return 0;
  const avisos = data as AvisoPush[];

  const localIds = [...new Set(avisos.filter((a) => !a.empleado_id).map((a) => a.local_id))];
  const empIds = [...new Set(avisos.map((a) => a.empleado_id).filter((x): x is string => Boolean(x)))];
  const [mgrSubs, empSubs, emps] = await Promise.all([
    localIds.length ? db.from("push_suscripciones").select("id, local_id, empleado_id, endpoint, p256dh, auth").is("empleado_id", null).in("local_id", localIds) : { data: [] },
    empIds.length ? db.from("push_suscripciones").select("id, local_id, empleado_id, endpoint, p256dh, auth").in("empleado_id", empIds) : { data: [] },
    empIds.length ? db.from("empleados").select("id, nombre, token_acceso").in("id", empIds) : { data: [] },
  ]);
  const subs = [...((mgrSubs.data ?? []) as Sub[]), ...((empSubs.data ?? []) as Sub[])];
  if (!subs.length) return 0;
  const linkOf = new Map(((emps.data ?? []) as { id: string; nombre: string; token_acceso: string }[]).map((e) => [e.id, `/h/${employeePath(e.nombre, e.token_acceso)}`]));
  const base = await getBaseUrl();

  let sent = 0;
  const gone: string[] = [];
  await Promise.all(
    avisos.flatMap((a) => {
      const targets = a.empleado_id ? subs.filter((s) => s.empleado_id === a.empleado_id) : subs.filter((s) => !s.empleado_id && s.local_id === a.local_id);
      const path = a.empleado_id ? (linkOf.get(a.empleado_id) ?? "/") : a.enlace?.startsWith("/") ? a.enlace : "/app/cuadrante";
      const payload = pushPayload(a, `${base}${path}`);
      return targets.map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 24, urgency: "normal" });
          sent++;
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          // El móvil ya no acepta avisos (se desinstaló o se quitó el permiso).
          if (status === 404 || status === 410) gone.push(s.id);
        }
      });
    }),
  );
  if (gone.length) await db.from("push_suscripciones").delete().in("id", gone);
  return sent;
}

/** La suscripción que da el navegador (validada antes de guardarla). */
const pushSubscriptionSchema = z.object({
  endpoint: z.url().startsWith("https://").max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(4).max(100) }),
});
export type PushSubscriptionInput = z.input<typeof pushSubscriptionSchema>;

/** Guarda (o actualiza) la suscripción de un dispositivo. */
export async function saveSubscription(input: unknown, owner: { localId: string; employeeId?: string | null; userId?: string | null }): Promise<boolean> {
  const parsed = pushSubscriptionSchema.safeParse(input);
  if (!parsed.success) return false;
  const db = createAdminClient();
  const { error } = await db.from("push_suscripciones").upsert(
    {
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      local_id: owner.localId,
      empleado_id: owner.employeeId ?? null,
      usuario_id: owner.userId ?? null,
    },
    { onConflict: "endpoint" },
  );
  return !error;
}

/** Quita la suscripción de un dispositivo (solo si es de quien la pide). */
export async function removeSubscription(endpoint: string, owner: { localId: string; employeeId?: string | null }): Promise<boolean> {
  if (typeof endpoint !== "string" || endpoint.length > 1000) return false;
  const db = createAdminClient();
  let q = db.from("push_suscripciones").delete().eq("endpoint", endpoint).eq("local_id", owner.localId);
  q = owner.employeeId ? q.eq("empleado_id", owner.employeeId) : q.is("empleado_id", null);
  const { error } = await q;
  return !error;
}
