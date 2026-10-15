import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Se ejecuta antes de cada petición a /app, /bienvenida y /nueva-contrasena:
 *  1. Refresca la sesión de Supabase (renueva el token si ha caducado y
 *     reescribe las cookies). Sin esto, la sesión caducaría a la hora.
 *  2. Si no hay sesión, redirige a /login. Es una comprobación "optimista":
 *     la protección real son las políticas RLS de la base de datos y el
 *     requireUser() de cada página.
 *  3. Si hay sesión pero aún no ha creado su negocio, /app lleva a
 *     /bienvenida (y al revés). Así las páginas no redirigen mientras se
 *     renderizan.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next(); // sin configurar: las páginas muestran cómo hacerlo

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // getClaims verifica el token (localmente si el proyecto usa claves asimétricas)
  // y lo renueva si está a punto de caducar.
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims?.sub) return redirectTo(request, response, "/login");

  // Solo al navegar (GET): las Server Actions van por POST y no se redirigen.
  const path = request.nextUrl.pathname;
  if (request.method === "GET" && (path.startsWith("/app") || path === "/bienvenida")) {
    const { data: locales, error } = await supabase.from("locales").select("id").limit(1);
    if (!error) {
      const hasLocal = (locales?.length ?? 0) > 0;
      if (!hasLocal && path.startsWith("/app")) return redirectTo(request, response, "/bienvenida");
      if (hasLocal && path === "/bienvenida") return redirectTo(request, response, "/app/cuadrante");
    }
  }
  return response;
}

/** Redirige conservando las cookies de sesión que se acaban de renovar. */
function redirectTo(request: NextRequest, response: NextResponse, pathname: string) {
  const target = request.nextUrl.clone();
  target.pathname = pathname;
  target.search = "";
  const redirect = NextResponse.redirect(target);
  response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
  return redirect;
}

export const config = {
  matcher: ["/app/:path*", "/bienvenida", "/nueva-contrasena"],
};
