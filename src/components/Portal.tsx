"use client";

import { createPortal } from "react-dom";

/**
 * Pinta los diálogos directamente en <body>. Así quedan siempre por encima de
 * la cabecera, aunque estén dentro de una zona que crea su propia capa
 * (animaciones, desenfoques, `sticky`…).
 */
export function Portal({ children }: { children: React.ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}
