import { getEmployeeByToken } from "@/lib/data/employee-view";

/**
 * Cada empleado instala SU página: al abrir el icono va directo a su horario.
 * (En iPhone es lo que permite recibir avisos.)
 */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const me = await getEmployeeByToken(token);
  if (!me) return new Response("Enlace no válido", { status: 404 });
  const body = {
    name: `Mi horario · ${me.nombre}`,
    short_name: "Mi horario",
    description: "Tu horario y fichaje en Rotafy",
    id: `/h/${token}`,
    start_url: `/h/${token}`,
    scope: `/h/${token}`,
    display: "standalone",
    background_color: "#F4F3EE",
    theme_color: "#1F5C46",
    lang: "es",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/manifest+json; charset=utf-8", "Cache-Control": "private, max-age=3600", "X-Robots-Tag": "noindex" },
  });
}
