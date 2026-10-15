import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Se ejecuta antes de cada petición a /app, /bienvenida y /nueva-contrasena:
 *  1. Refresca la sesión de Supabase (renueva el token si ha caducado y
 *     reescribe las cookies). Sin esto, la sesión caducaría a la hora.
 *  2. Si no hay sesión, redirige a /login. Es una comprobación "optimista":
 *     la protección real son las políticas RLS de la base de datos y el
 *     requireUser() de cada página.
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

  if (!data?.claims?.sub) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = "";
    return NextResponse.redirect(login);
  }
  return response;
}

export const config = {
  matcher: ["/app/:path*", "/bienvenida", "/nueva-contrasena"],
};
