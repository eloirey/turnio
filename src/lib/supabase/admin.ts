import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Cliente con la service role key: SALTA las políticas RLS.
 * Solo se usa en el servidor para la vista del empleado por token, donde la
 * comprobación de acceso la hacemos nosotros (token válido y empleado activo).
 * El import de "server-only" hace fallar el build si alguien lo importa en el navegador.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY en .env.local");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
