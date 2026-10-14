import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center gap-8 px-6 py-16">
      <div className="font-display text-2xl font-bold tracking-tight text-accent">turnio</div>
      <h1 className="font-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
        El cuadrante de la semana, hecho en un minuto.
      </h1>
      <p className="max-w-xl text-lg leading-relaxed text-ink-soft">
        Turnio genera los turnos de tu equipo según la disponibilidad y las horas de contrato de cada uno, te avisa de
        los conflictos y manda a cada empleado su horario con un enlace. Sin Excel y sin fotos perdidas en el grupo.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/demo"
          className="flex h-12 items-center rounded-[10px] bg-accent px-6 text-base font-semibold text-white"
        >
          Probar la demo
        </Link>
      </div>
    </main>
  );
}
