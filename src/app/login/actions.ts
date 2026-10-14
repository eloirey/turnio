"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getBaseUrl } from "@/lib/url";

export interface AuthState {
  error?: string;
  message?: string;
  email?: string;
}

const schema = z.object({
  email: z.email("Escribe un email válido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});

/** Traduce los errores más comunes de Supabase Auth. */
function translate(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Email o contraseña incorrectos.";
  if (m.includes("already registered")) return "Ya existe una cuenta con ese email. Prueba a entrar.";
  if (m.includes("email not confirmed")) return "Confirma tu email: te hemos enviado un enlace.";
  if (m.includes("rate limit")) return "Demasiados intentos. Espera un minuto y vuelve a probar.";
  if (m.includes("weak") || m.includes("password")) return "Esa contraseña es demasiado débil. Usa al menos 8 caracteres.";
  return "No se ha podido completar. Inténtalo de nuevo.";
}

function parse(formData: FormData) {
  return schema.safeParse({ email: formData.get("email"), password: formData.get("password") });
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = parse(formData);
  const email = String(formData.get("email") ?? "");
  if (!parsed.success) return { error: parsed.error.issues[0].message, email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: translate(error.message), email };
  redirect("/app");
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = parse(formData);
  const email = String(formData.get("email") ?? "");
  if (!parsed.success) return { error: parsed.error.issues[0].message, email };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: { emailRedirectTo: `${await getBaseUrl()}/auth/callback` },
  });
  if (error) return { error: translate(error.message), email };

  // Si en Supabase está desactivada la confirmación por email, ya hay sesión.
  if (data.session) redirect("/bienvenida");
  return { message: `Te hemos enviado un email a ${parsed.data.email}. Abre el enlace para activar tu cuenta.`, email };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
