import type { Metadata } from "next";
import "@fontsource-variable/dm-sans";
import "@fontsource-variable/bricolage-grotesque";
import "./globals.css";

export const metadata: Metadata = {
  title: "Turnio — Cuadrantes de turnos sin Excel",
  description: "Genera el cuadrante semanal de tu equipo en segundos y avisa a todos con un enlace.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
