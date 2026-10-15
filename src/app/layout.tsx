import type { Metadata, Viewport } from "next";
import { bricolage, dmSans } from "./_fonts/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rotafy — Cuadrantes de turnos sin Excel",
  description: "Genera el cuadrante semanal de tu equipo en segundos y avisa a todos con un enlace.",
  // Se puede «instalar» en el móvil (y así recibir avisos también en iPhone).
  appleWebApp: { capable: true, title: "Rotafy", statusBarStyle: "default" },
  icons: { apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#F4F3EE",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${dmSans.variable} ${bricolage.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
