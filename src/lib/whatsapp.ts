/**
 * Enlaces de WhatsApp sin API: https://wa.me/<teléfono>?text=<mensaje>
 * Al abrirlos, WhatsApp abre el chat con el mensaje ya escrito y el
 * encargado solo pulsa "enviar". Gratis y sin registros con Meta.
 */

/** Normaliza un teléfono español a formato internacional sin "+" (34XXXXXXXXX). */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  else if (digits.startsWith("00")) digits = digits.slice(2);
  digits = digits.replace(/\D/g, "");
  // Móvil o fijo español sin prefijo: 9 dígitos que empiezan por 6, 7, 8 o 9.
  if (/^[6-9]\d{8}$/.test(digits)) return `34${digits}`;
  // Ya viene con prefijo internacional (entre 10 y 15 dígitos según la norma E.164).
  if (/^[1-9]\d{9,14}$/.test(digits)) return digits;
  return null;
}

export function whatsappLink(message: string, phone?: string | null): string {
  const p = normalizePhone(phone);
  return `https://wa.me/${p ?? ""}?text=${encodeURIComponent(message)}`;
}
