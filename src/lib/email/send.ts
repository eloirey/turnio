import "server-only";
import { CONTACT, welcomeEmail } from "./templates";

/**
 * Envío de correos de la app con Resend (el mismo servicio que usa Supabase
 * para los de la cuenta). Hace falta RESEND_API_KEY en las variables de
 * entorno; sin ella, no se manda nada y la app sigue igual.
 */
const API = process.env.RESEND_API_URL || "https://api.resend.com/emails";
const FROM = `Rotafy <${CONTACT}>`;

export const emailConfigured = () => Boolean(process.env.RESEND_API_KEY);

export async function sendEmail(msg: { to: string; subject: string; html: string; text: string }): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, reply_to: CONTACT, to: [msg.to], subject: msg.subject, html: msg.html, text: msg.text }),
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Bienvenida al crear el negocio. */
export async function sendWelcome(to: string | null | undefined, localName: string, appUrl: string): Promise<boolean> {
  if (!to || !emailConfigured()) return false;
  return sendEmail({ to, ...welcomeEmail({ localName, appUrl }) });
}
