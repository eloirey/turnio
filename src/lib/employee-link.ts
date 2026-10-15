/**
 * Enlace personal de cada empleado: /h/laura-<token>.
 *
 * El nombre es solo para que se reconozca el enlace; lo que da acceso es el token
 * aleatorio del final (32 caracteres). Por eso:
 * - si cambias el nombre de la persona, su enlace antiguo sigue funcionando;
 * - los enlaces antiguos sin nombre (/h/<token>) también siguen funcionando.
 */

/** "María José" → "maria-jose" (sin acentos ni símbolos, máximo 24 caracteres). */
export function nameSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24)
    .replace(/-+$/g, "");
}

/** Parte de la ruta del enlace: "laura-<token>", o solo el token si el nombre no deja nada. */
export function employeePath(name: string, token: string): string {
  const slug = nameSlug(name);
  return slug ? `${slug}-${token}` : token;
}

/** Saca el token de "laura-<token>" o de "<token>". Devuelve null si no hay un token válido. */
export function tokenFromPath(param: string): string | null {
  let value = param;
  try {
    value = decodeURIComponent(param);
  } catch {
    // si viene mal codificado, se usa tal cual
  }
  const match = /(?:^|-)([a-f0-9]{32})$/.exec(value.toLowerCase());
  return match ? match[1] : null;
}
