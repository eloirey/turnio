/**
 * Correos de Rotafy, con el mismo diseño:
 *  - Los de la cuenta (confirmar, restablecer contraseña, cambiar email) los
 *    manda Supabase: se generan en supabase/templates/*.html y se pegan en
 *    Authentication → Emails → Templates (ver README).
 *
 * HTML de correo «a la antigua» (tablas y estilos en línea) para que se vea
 * igual en Gmail, Outlook y Apple Mail. Sin fuentes externas: el logo es una
 * imagen y el texto usa fuentes del sistema.
 */

export const SITE = "https://rotafy.es";
export const CONTACT = "hola@rotafy.es";

const C = {
  ground: "#F4F3EE",
  card: "#FFFFFF",
  line: "#E6E3DA",
  ink: "#1B1B1A",
  soft: "#4A4843",
  muted: "#6B6860",
  accent: "#1F5C46",
};
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

/** Escapa texto para meterlo en HTML (nombres que escribe la gente). */
export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export interface EmailParts {
  /** Texto que se ve en la bandeja de entrada junto al asunto. */
  preheader: string;
  title: string;
  /** Párrafos (HTML ya escapado). */
  body: string[];
  button: { label: string; url: string };
  /** Letra pequeña: caducidad, «si no has sido tú…». */
  note?: string;
  /** Mostrar el enlace en texto por si el botón no funciona. */
  showLink?: boolean;
  /** Por qué recibe este correo (pie). */
  reason: string;
}

const p = (html: string, last = false) =>
  `<p style="margin:0 0 ${last ? 0 : 16}px;font-family:${FONT};font-size:16px;line-height:1.6;color:${C.soft};">${html}</p>`;

export function layout(e: EmailParts): string {
  const { url, label } = e.button;
  return `<!DOCTYPE html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${e.title}</title>
<style>
  @media (max-width: 600px) {
    .card { padding: 28px 22px !important; }
    .h1 { font-size: 24px !important; }
    .btn { width: 100% !important; }
    .btn a { display: block !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${C.ground};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${e.preheader}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.ground};">
  <tr>
    <td align="center" style="padding:40px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
        <tr>
          <td style="padding:0 4px 24px;">
            <a href="${SITE}" style="text-decoration:none;"><img src="${SITE}/email/logo.png" width="134" height="38" alt="rotafy" style="display:block;border:0;outline:none;font-family:${FONT};font-size:24px;font-weight:700;color:${C.ink};"></a>
          </td>
        </tr>
        <tr>
          <td class="card" style="background:${C.card};border:1px solid ${C.line};border-radius:16px;padding:40px 40px 36px;">
            <h1 class="h1" style="margin:0 0 16px;font-family:${FONT};font-size:28px;line-height:1.2;font-weight:700;letter-spacing:-0.02em;color:${C.ink};">${e.title}</h1>
            ${e.body.map((b, i) => p(b, i === e.body.length - 1)).join("\n            ")}
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" class="btn" style="margin:28px 0 0;">
              <tr>
                <td align="center" style="border-radius:10px;background:${C.accent};">
                  <a href="${url}" target="_blank" style="display:inline-block;padding:15px 30px;font-family:${FONT};font-size:16px;font-weight:700;line-height:1;color:#FFFFFF;text-decoration:none;border-radius:10px;">${label}</a>
                </td>
              </tr>
            </table>${
              e.note
                ? `
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:32px;">
              <tr><td style="border-top:1px solid ${C.line};padding-top:20px;font-family:${FONT};font-size:13px;line-height:1.6;color:${C.muted};">${e.note}${
                e.showLink
                  ? `<br><br>¿El botón no funciona? Copia y pega este enlace en tu navegador:<br><a href="${url}" style="color:${C.accent};word-break:break-all;">${url}</a>`
                  : ""
              }</td></tr>
            </table>`
                : ""
            }
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:28px 16px 0;font-family:${FONT};font-size:12px;line-height:1.7;color:${C.muted};">
            ${e.reason}<br>
            ¿Dudas? Escríbenos a <a href="mailto:${CONTACT}" style="color:${C.muted};">${CONTACT}</a><br>
            <a href="${SITE}" style="color:${C.muted};text-decoration:none;"><strong>Rotafy</strong></a> · Cuadrantes de turnos y registro de jornada
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>
`;
}

// ---------- Plantillas de Supabase (variables {{ .X }} de Supabase) ----------

export const SUPABASE_TEMPLATES = {
  "confirmar-cuenta": {
    subject: "Confirma tu email y empieza con Rotafy",
    html: layout({
      preheader: "Un clic y empiezas a hacer tu cuadrante.",
      title: "Te damos la bienvenida a Rotafy",
      body: [
        "Solo falta confirmar que este email es tuyo. Después eliges tu sector y en unos minutos tienes el cuadrante de la semana hecho.",
      ],
      button: { label: "Confirmar mi email", url: "{{ .ConfirmationURL }}" },
      note: "Por seguridad, el enlace caduca en 1 hora y solo sirve una vez. Ábrelo en el mismo dispositivo y navegador en el que te registraste.",
      showLink: true,
      reason: "Recibes este correo porque alguien creó una cuenta en Rotafy con {{ .Email }}. Si no has sido tú, ignóralo.",
    }),
  },
  "restablecer-contrasena": {
    subject: "Restablece tu contraseña de Rotafy",
    html: layout({
      preheader: "Elige una contraseña nueva para tu cuenta.",
      title: "Elige una contraseña nueva",
      body: ["Hemos recibido una petición para cambiar la contraseña de tu cuenta de Rotafy ({{ .Email }}). Pulsa el botón y escribe la nueva."],
      button: { label: "Elegir contraseña nueva", url: "{{ .ConfirmationURL }}" },
      note: "El enlace caduca en 1 hora y solo sirve una vez (si lo pides varias veces, vale el último). Ábrelo en el mismo navegador en el que lo pediste.<br><br><strong style=\"color:#4A4843;\">¿No lo has pedido tú?</strong> Ignora este correo: tu contraseña no cambia.",
      showLink: true,
      reason: "Recibes este correo porque se pidió restablecer la contraseña de {{ .Email }} en Rotafy.",
    }),
  },
  "cambiar-email": {
    subject: "Confirma tu nuevo email en Rotafy",
    html: layout({
      preheader: "Confirma el cambio de email de tu cuenta.",
      title: "Confirma tu nuevo email",
      body: ["Has pedido cambiar el email de tu cuenta de Rotafy de <strong style=\"color:#1B1B1A;\">{{ .Email }}</strong> a <strong style=\"color:#1B1B1A;\">{{ .NewEmail }}</strong>. Confírmalo para que el cambio se haga."],
      button: { label: "Confirmar el cambio", url: "{{ .ConfirmationURL }}" },
      note: "El enlace caduca en 1 hora y solo sirve una vez. Si no has pedido este cambio, ignora este correo y escríbenos.",
      showLink: true,
      reason: "Recibes este correo por un cambio de email en tu cuenta de Rotafy.",
    }),
  },
} as const;
