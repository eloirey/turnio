import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";

/**
 * Cliente de Supabase para el servidor (Server Components, Server Actions,
 * Route Handlers). Lee la sesión del encargado desde las cookies, así que
 * las políticas RLS se aplican con su identidad.
 */
export async function createClient() {
  const cookieStore = await cookies();
  // Todo lo que pasa por Supabase depende de la sesión y de la hora (el SDK
  // comprueba si el token ha caducado con Date.now()), así que se hace siempre
  // al recibir la petición y nunca durante el prerenderizado.
  await connection();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Llamado desde un Server Component: no puede escribir cookies.
            // No pasa nada si el middleware refresca la sesión.
          }
        },
      },
    },
  );
}
