/**
 * Canales para mandar el horario o el enlace a cada persona. Ninguno usa API:
 * se abre la app con el mensaje ya escrito y el encargado solo pulsa enviar.
 */
import { whatsappLink } from "./whatsapp";

export type Channel = "whatsapp" | "telegram" | "copy";

export const CHANNELS: { key: Channel; label: string }[] = [
  { key: "whatsapp", label: "WhatsApp" },
  { key: "telegram", label: "Telegram" },
  { key: "copy", label: "Copiar texto" },
];

/**
 * Telegram: https://t.me/share/url abre la app para elegir el chat con el
 * texto escrito. No deja elegir el contacto por teléfono, así que el
 * encargado lo busca en la lista.
 */
export function telegramLink(text: string, url?: string): string {
  return url ? `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}` : `https://t.me/share/url?url=${encodeURIComponent(text)}`;
}

export interface ShareMessage {
  /** Texto completo, con el enlace dentro. */
  full: string;
  /** Texto sin el enlace (Telegram lo adjunta aparte). */
  noLink?: string;
  link?: string;
  phone?: string | null;
}

/** Enlace que abre la app elegida (null si el canal es copiar). */
export function shareHref(channel: Channel, m: ShareMessage): string | null {
  if (channel === "whatsapp") return whatsappLink(m.full, m.phone);
  if (channel === "telegram") return m.link && m.noLink ? telegramLink(m.noLink, m.link) : telegramLink(m.full);
  return null;
}

const KEY = "rotafy:canal";

export function savedChannel(): Channel {
  try {
    const v = window.localStorage.getItem(KEY);
    return v === "telegram" || v === "copy" ? v : "whatsapp";
  } catch {
    return "whatsapp";
  }
}

export function saveChannel(c: Channel) {
  try {
    window.localStorage.setItem(KEY, c);
  } catch {
    // sin almacenamiento: se queda solo para esta vez
  }
}
