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
  const invite = inviteOf(formData);
  redirect(invite ? `/invitacion/${invite}` : await homePath(supabase));
}

/** Si viene de una invitación de otro encargado, vuelve allí tras entrar. */
function inviteOf(formData: FormData | null): string | null {
  const v = String(formData?.get("invitacion") ?? "");
  return /^[0-9a-f]{32}$/.test(v) ? v : null;
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = parse(formData);
  const email = String(formData.get("email") ?? "");
  if (!parsed.success) return { error: parsed.error.issues[0].message, email };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: { emailRedirectTo: `${await getBaseUrl()}/auth/callback${inviteOf(formData) ? `?next=/invitacion/${inviteOf(formData)}` : ""}` },
  });
  if (error) return { error: translate(error.message), email };

  // Si en Supabase está desactivada la confirmación por email, ya hay sesión.
  if (data.session) redirect(inviteOf(formData) ? `/invitacion/${inviteOf(formData)}` : "/bienvenida");
  return { message: `Te hemos enviado un email a ${parsed.data.email}. Abre el enlace para activar tu cuenta.`, email };
}

/** Entrar (o registrarse) con Google. Supabase devuelve la URL de Google y volvemos a /auth/callback. */
export async function signInWithGoogle(formData?: FormData | null): Promise<AuthState> {
  const supabase = await createClient();
  const invite = inviteOf(formData ?? null);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${await getBaseUrl()}/auth/callback?next=${invite ? `/invitacion/${invite}` : "/app"}` },
  });
  if (error || !data.url) return { error: "No se ha podido conectar con Google. Inténtalo de nuevo." };
  redirect(data.url);
}

const emailOnly = z.object({ email: z.email("Escribe un email válido") });

/** Envía el email para elegir una contraseña nueva. Siempre responde lo mismo (no revela si la cuenta existe). */
export async function requestPasswordReset(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "");
  const parsed = emailOnly.safeParse({ email });
  if (!parsed.success) return { error: parsed.error.issues[0].message, email };
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await getBaseUrl()}/auth/callback?next=/nueva-contrasena`,
  });
  if (error && error.message.toLowerCase().includes("rate limit")) return { error: translate(error.message), email };
  return { message: `Si hay una cuenta con ${parsed.data.email}, te llegará un email con un enlace para elegir una contraseña nueva.`, email };
}

const newPassword = z
  .object({
    password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(72, "Contraseña demasiado larga"),
    repeat: z.string(),
  })
  .refine((v) => v.password === v.repeat, { message: "Las dos contraseñas no coinciden" });

export async function updatePassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = newPassword.safeParse({ password: formData.get("password"), repeat: formData.get("repeat") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    const m = error.message.toLowerCase();
    if (m.includes("session") || m.includes("jwt")) return { error: "El enlace ha caducado. Pide uno nuevo desde «He olvidado mi contraseña»." };
    if (m.includes("different")) return { error: "La contraseña nueva tiene que ser distinta de la anterior." };
    return { error: translate(error.message) };
  }
  redirect(await homePath(supabase));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/** Tras entrar: al cuadrante si ya tiene negocio y, si no, a crearlo. */
async function homePath(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string> {
  const { data } = await supabase.from("locales").select("id").limit(1);
  return data?.length ? "/app/cuadrante" : "/bienvenida";
}
