import Link from "next/link";
import { ui } from "@/components/ui";

const STEPS = [
  {
    n: "1",
    title: "Añade a tu equipo",
    text: "Nombre, puesto, horas de contrato y cuándo puede trabajar cada uno. Solo la primera vez.",
  },
  {
    n: "2",
    title: "Genera el cuadrante",
    text: "Turnio reparte los turnos según lo que necesitas cada día y te avisa si falta alguien o alguien cierra demasiadas noches.",
  },
  {
    n: "3",
    title: "Publica y avisa",
    text: "Cada empleado recibe su horario por WhatsApp con un enlace personal. Sin apps que instalar ni cuentas que crear.",
  },
];

const PAINS = [
  ["Una tarde entera con el Excel", "Lo genera en segundos y tú solo retocas."],
  ["“¿Cuál es el horario bueno?”", "Un único enlace, siempre actualizado."],
  ["Cambios pactados por privado", "Se piden en la app y tú los apruebas."],
  ["El sábado falta alguien en barra", "Lo ves en rojo antes de publicar."],
];

export default function Home() {
  return (
    <div className="min-h-screen bg-ground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="font-display text-2xl font-bold tracking-tight text-accent">turnio</span>
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/demo" className="min-h-11 rounded-lg px-3 py-3 font-semibold text-ink-soft hover:bg-surface">
            Demo
          </Link>
          <Link href="/login" className={`${ui.btnSm} ${ui.secondary}`}>
            Entrar
          </Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-6 pb-16 pt-10 sm:pt-16">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.08em] text-accent">Para bares y restaurantes</p>
          <h1 className="max-w-3xl font-display text-5xl font-bold leading-[1.02] tracking-tight sm:text-7xl">
            El cuadrante de la semana, hecho en un minuto.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft">
            Turnio genera los turnos de tu equipo respetando disponibilidad y horas de contrato, te avisa de los conflictos y
            manda a cada uno su horario. Sin Excel y sin fotos perdidas en el grupo.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/login" className={`${ui.btn} ${ui.primary} h-12 px-6 text-base`}>
              Empieza gratis
            </Link>
            <Link href="/demo" className={`${ui.btn} ${ui.secondary} h-12 px-6 text-base`}>
              Probar la demo
            </Link>
          </div>
        </section>

        <section className="border-y border-line bg-surface">
          <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n}>
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-accent font-display text-lg font-bold text-white">
                  {s.n}
                </div>
                <h2 className="font-display text-2xl font-bold">{s.title}</h2>
                <p className="mt-2 leading-relaxed text-ink-soft">{s.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Lo que deja de pasar</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {PAINS.map(([before, after]) => (
              <div key={before} className={`${ui.card} p-5`}>
                <p className="text-ink-muted line-through decoration-danger/50">{before}</p>
                <p className="mt-1.5 text-lg font-semibold">{after}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-20">
          <div className="rounded-3xl bg-accent px-8 py-12 text-white sm:px-12">
            <h2 className="max-w-2xl font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Prueba con tu equipo la semana que viene.
            </h2>
            <p className="mt-3 max-w-xl text-white/85">Configurarlo lleva diez minutos. Si no te ahorra tiempo, vuelves al Excel.</p>
            <Link href="/login" className={`${ui.btn} mt-6 h-12 bg-white px-6 text-base text-accent-ink hover:bg-ground`}>
              Crear mi cuenta
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line px-6 py-8 text-center text-sm text-ink-muted">Turnio · Cuadrantes de turnos para hostelería</footer>
    </div>
  );
}
