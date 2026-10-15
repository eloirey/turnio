import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Vuelta desde Supabase (email de confirmación, recuperar contraseña o Google).
 * Llega con ?code=..., que cambiamos por una sesión (flujo PKCE), y mandamos
 * al usuario a `next` (solo rutas internas, para no abrir redirecciones).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/app";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/app";

  if (searchParams.get("error")) {
    // Enlace del email ya usado o caducado (otp_expired…) ≠ haber cancelado el login con Google.
    const detail = `${searchParams.get("error_code") ?? ""} ${searchParams.get("error_description") ?? ""}`.toLowerCase();
    const kind = /denied|cancel/.test(detail) && !/otp|expired|invalid/.test(detail) ? "cancelado" : "enlace";
    return NextResponse.redirect(`${origin}/login?error=${kind}`);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/login?error=enlace`);
}
