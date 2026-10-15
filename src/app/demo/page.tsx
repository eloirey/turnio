import { DemoApp } from "./DemoApp";

export const metadata = {
  title: "Demo · Rotafy",
  description: "Prueba Rotafy con un negocio de ejemplo: equipo, necesidades, cuadrante automático y fichajes. Sin registrarte.",
};

/** Demo completa: todo ocurre en el navegador y no se guarda nada. */
export default function DemoPage() {
  return <DemoApp />;
}
