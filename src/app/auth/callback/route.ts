import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Destino del enlace del email de confirmación. Supabase añade ?code=...,
 * que cambiamos por una sesión (flujo PKCE) y mandamos al usuario a la app.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/bienvenida`);
  }
  return NextResponse.redirect(`${origin}/login?error=enlace`);
}
