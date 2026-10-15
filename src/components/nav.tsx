"use client";

import Link from "next/link";
import { createContext, useContext, type ReactNode } from "react";

/**
 * Navegación entre pantallas de la app. En la app real son enlaces normales;
 * en la demo (todo en el navegador) cambian de pestaña sin salir de la página.
 */
const NavContext = createContext<((href: string) => void) | null>(null);

export function NavProvider({ onNavigate, children }: { onNavigate: (href: string) => void; children: ReactNode }) {
  return <NavContext.Provider value={onNavigate}>{children}</NavContext.Provider>;
}

export function useNavigate() {
  return useContext(NavContext);
}

export function NavLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  const navigate = useContext(NavContext);
  if (navigate) {
    return (
      <button type="button" onClick={() => navigate(href)} className={className}>
        {children}
      </button>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

/** ¿Estamos en la demo? (para textos como "No se guarda nada"). */
export function useIsDemo() {
  return useContext(NavContext) !== null;
}
