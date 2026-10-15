import localFont from "next/font/local";

/*
 * Fuentes servidas por la propia app (sin Google Fonts): Next las precarga y
 * crea una fuente de reserva con las mismas medidas, así el texto no «salta»
 * al cargar. Solo el juego latino, que cubre el español y el catalán.
 */
export const dmSans = localFont({
  src: "./dm-sans-latin-wght-normal.woff2",
  weight: "100 1000",
  display: "swap",
  variable: "--font-dm-sans",
  fallback: ["system-ui", "sans-serif"],
});

export const bricolage = localFont({
  src: "./bricolage-grotesque-latin-wght-normal.woff2",
  weight: "200 800",
  display: "swap",
  variable: "--font-bricolage",
  fallback: ["system-ui", "sans-serif"],
});
