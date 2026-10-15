import type { MetadataRoute } from "next";

/** Para instalar Rotafy en el móvil del encargado (y recibir avisos en iPhone). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Rotafy",
    short_name: "Rotafy",
    description: "Cuadrantes de turnos y fichaje para tu equipo",
    start_url: "/app/cuadrante",
    scope: "/",
    display: "standalone",
    background_color: "#F4F3EE",
    theme_color: "#1F5C46",
    lang: "es",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
