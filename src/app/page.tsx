import Link from "next/link";
import { Logo, LogoMark } from "@/components/Logo";
import { ui } from "@/components/ui";
import { PALETTE } from "@/lib/roles";

export const metadata = {
  title: "Rotafy — El cuadrante de turnos de tu equipo, en un minuto",
  description:
    "Genera el cuadrante semanal respetando disponibilidad, contratos y descansos legales. Cada empleado recibe su horario por WhatsApp y en su calendario.",
};

const FEATURES = [
  { title: "Se genera solo", text: "Reparte los turnos según lo que necesitas cada día, la disponibilidad y las horas de contrato. Tú solo retocas." },
  { title: "Cumple los descansos", text: "Avisa si alguien descansa menos de 12 horas entre jornadas o libra menos días de los que toca." },
  { title: "Avisos por WhatsApp", text: "Al publicar, mandas a cada persona su horario con un toque. Sin fotos del Excel perdidas en el grupo." },
  { title: "En su calendario", text: "Cada empleado se suscribe una vez y sus turnos aparecen solos en el móvil, también cuando cambian." },
  { title: "Cambios ordenados", text: "Quien necesita librar o cambiarse con un compañero lo pide en la app. Tú lo aceptas con un toque." },
  { title: "Vacaciones y bajas", text: "Apunta las ausencias y el generador no asignará turnos esos días." },
];

const PAINS = [
  ["Una tarde entera con el Excel", "Un cuadrante listo en segundos"],
  ["“¿Cuál es el horario bueno?”", "Un enlace por persona, siempre al día"],
  ["Cambios pactados por privado", "Se piden en la app y tú decides"],
  ["El sábado falta alguien en barra", "Lo ves en rojo antes de publicar"],
];

const SECTORS = ["Bares y restaurantes", "Cafeterías", "Tiendas y comercios", "Residencias", "Gimnasios", "Hoteles y alojamientos"];

const FAQ = [
  ["¿Mis empleados tienen que instalar algo?", "No. Cada persona recibe un enlace personal que se abre en el navegador del móvil. Si quiere, lo añade a su calendario."],
  ["¿Sirve para mi tipo de negocio?", "Sí, si tu equipo trabaja por turnos. Tú defines los puestos (sala, caja, auxiliares…), las franjas horarias y cuánta gente necesitas cada día."],
  ["¿Cumple la normativa laboral?", "Rotafy te avisa de los descansos mínimos entre jornadas, los días libres y las horas de contrato según las reglas que configures. La responsabilidad final del cuadrante sigue siendo de la empresa."],
  ["¿Dónde se guardan los datos?", "En servidores de la Unión Europea, con acceso cifrado. Cada negocio solo puede ver sus propios datos."],
  ["¿Cuánto cuesta?", "Ahora mismo es gratis mientras dure el piloto, sin tarjeta. Si en el futuro pasa a ser de pago, te avisaremos antes y podrás decidir con calma."],
];

export default function Home() {
  return (
    <div className="min-h-screen bg-ground text-ink">
      <header className="sticky top-0 z-30 border-b border-line/70 bg-ground/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <Link href="/" aria-label="Rotafy">
            <Logo size="sm" />
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link href="/demo" className="hidden min-h-11 items-center rounded-lg px-3 font-medium text-ink-soft hover:text-ink sm:flex">
              Ver demo
            </Link>
            <Link href="/login" className="flex min-h-11 items-center rounded-lg px-3 font-medium text-ink-soft hover:text-ink">
              Entrar
            </Link>
            <Link href="/login" className={`${ui.btnSm} ${ui.primary} ml-1`}>
              Empieza gratis
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* ---------- Hero ---------- */}
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-12 lg:grid-cols-[1.05fr_1fr] lg:pt-20">
          <div>
            <p className="mb-5 inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1 text-[13px] font-semibold text-accent-ink">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Gratis durante el piloto
            </p>
            <h1 className="font-display text-[44px] font-bold leading-[1.02] tracking-tight sm:text-[64px]">
              El cuadrante de la semana, hecho en un minuto.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft">
              Rotafy reparte los turnos de tu equipo respetando disponibilidad, contratos y descansos, te avisa de lo que falla y manda a cada persona su
              horario por WhatsApp.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/login" className={`${ui.btn} ${ui.primary} h-12 px-6 text-base`}>
                Crear mi cuadrante gratis
              </Link>
              <Link href="/demo" className={`${ui.btn} ${ui.secondary} h-12 px-6 text-base`}>
                Probar la demo
              </Link>
            </div>
            <p className="mt-5 text-sm text-ink-muted">Sin tarjeta · Tu equipo no instala nada · Datos en Europa</p>
          </div>
          <ProductPreview />
        </section>

        {/* ---------- Antes / después ---------- */}
        <section className="border-y border-line bg-surface">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <h2 className="max-w-2xl font-display text-3xl font-bold tracking-tight sm:text-4xl">Lo que deja de pasar cada semana</h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {PAINS.map(([before, after]) => (
                <div key={before} className="rounded-2xl border border-line p-5">
                  <p className="text-ink-muted line-through decoration-danger/50">{before}</p>
                  <p className="mt-1.5 text-lg font-semibold">{after}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- Cómo funciona ---------- */}
        <section className="mx-auto max-w-6xl px-5 py-16">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Así de simple</h2>
          <ol className="mt-8 grid gap-6 md:grid-cols-3">
            {[
              ["Añade a tu equipo", "Nombre, puesto, horas de contrato y cuándo puede trabajar cada persona. Solo la primera vez."],
              ["Genera y retoca", "Rotafy propone el cuadrante y marca en rojo lo que no cuadra. Tocas una casilla para cambiarla."],
              ["Publica y avisa", "Cada persona recibe su horario por WhatsApp y lo tiene siempre en su enlace y en su calendario."],
            ].map(([t, d], i) => (
              <li key={t} className="rounded-2xl bg-surface p-6 shadow-[0_1px_0_#E4E1D8]">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent font-display text-lg font-bold text-white">{i + 1}</span>
                <h3 className="mt-4 font-display text-2xl font-bold">{t}</h3>
                <p className="mt-2 leading-relaxed text-ink-soft">{d}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ---------- Funciones ---------- */}
        <section className="border-y border-line bg-surface">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <h2 className="max-w-2xl font-display text-3xl font-bold tracking-tight sm:text-4xl">Todo lo que necesita un encargado</h2>
            <div className="mt-8 grid gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f, i) => (
                <div key={f.title} className="flex gap-4">
                  <span className="mt-1 h-8 w-8 flex-none rounded-lg" style={{ backgroundColor: PALETTE[i].bg, boxShadow: `inset 0 0 0 1px ${PALETTE[i].fg}30` }} />
                  <div>
                    <h3 className="text-lg font-semibold">{f.title}</h3>
                    <p className="mt-1 leading-relaxed text-ink-soft">{f.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- Sectores ---------- */}
        <section className="mx-auto max-w-6xl px-5 py-16">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Para cualquier equipo con turnos</h2>
          <div className="mt-6 flex flex-wrap gap-2.5">
            {SECTORS.map((s) => (
              <span key={s} className="rounded-full border border-line-strong bg-surface px-4 py-2 text-[15px]">
                {s}
              </span>
            ))}
          </div>
        </section>

        {/* ---------- Preguntas ---------- */}
        <section className="border-t border-line bg-surface">
          <div className="mx-auto max-w-3xl px-5 py-16">
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Preguntas frecuentes</h2>
            <div className="mt-6 divide-y divide-line">
              {FAQ.map(([q, a]) => (
                <details key={q} className="group py-4">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold">
                    {q}
                    <span className="text-2xl text-ink-muted transition group-open:rotate-45" aria-hidden="true">
                      +
                    </span>
                  </summary>
                  <p className="mt-2 leading-relaxed text-ink-soft">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- Llamada final ---------- */}
        <section className="mx-auto max-w-6xl px-5 py-16">
          <div className="rounded-3xl bg-accent px-7 py-12 text-white sm:px-12">
            <h2 className="max-w-2xl font-display text-3xl font-bold tracking-tight sm:text-4xl">Haz el cuadrante de la semana que viene con Rotafy.</h2>
            <p className="mt-3 max-w-xl text-white/85">Configurarlo lleva diez minutos. Si no te ahorra tiempo, vuelves al Excel.</p>
            <Link href="/login" className={`${ui.btn} mt-7 h-12 bg-white px-6 text-base text-accent-ink hover:bg-ground`}>
              Crear mi cuenta gratis
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-sm text-ink-muted">
          <span className="flex items-center gap-2">
            <LogoMark size={20} /> Rotafy · Cuadrantes de turnos
          </span>
          <nav className="flex gap-5">
            <Link href="/legal/privacidad" className="hover:text-ink">
              Privacidad
            </Link>
            <Link href="/legal/aviso-legal" className="hover:text-ink">
              Aviso legal
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

/** Vista previa del producto hecha con HTML (no es una imagen: se ve nítida en cualquier pantalla). */
function ProductPreview() {
  const rows: { name: string; role: number; cells: (string | null)[] }[] = [
    { name: "Marta", role: 0, cells: ["09–17", "09–17", "09–17", "09–17", "09–17", null, null] },
    { name: "Jordi", role: 1, cells: ["17–01", null, "17–01", "17–01", null, "17–01", "09–17"] },
    { name: "Laura", role: 2, cells: [null, "17–01", "17–01", null, "17–01", "13–21", null] },
    { name: "Aleix", role: 0, cells: [null, null, null, null, "17–01", "13–21", null] },
  ];
  return (
    <div className="relative" aria-label="Vista previa de Rotafy" role="img">
      <div className="rounded-3xl border border-line bg-surface p-4 shadow-[0_30px_60px_-30px_rgba(27,27,26,0.35)] sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-muted">Semana 42</div>
            <div className="font-display text-xl font-bold">12 – 18 octubre</div>
          </div>
          <span className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white">Publicar y avisar</span>
        </div>
        <div className="grid grid-cols-[52px_repeat(7,1fr)] gap-1 text-[10px] sm:grid-cols-[60px_repeat(7,1fr)] sm:text-[11px]">
          <span />
          {["L", "M", "X", "J", "V", "S", "D"].map((d) => (
            <span key={d} className="text-center font-semibold text-ink-muted">
              {d}
            </span>
          ))}
          {rows.map((r) => (
            <div key={r.name} className="contents">
              <span className="flex items-center truncate font-semibold">{r.name}</span>
              {r.cells.map((c, i) => (
                <span
                  key={i}
                  className={`flex h-9 items-center justify-center rounded-md font-semibold ${c ? "" : "border border-dashed border-[#CFCBC0] text-[#A9A59B]"}`}
                  style={c ? { backgroundColor: PALETTE[r.role].bg, color: PALETTE[r.role].fg } : undefined}
                >
                  {c ?? "—"}
                </span>
              ))}
            </div>
          ))}
        </div>
        {/* La parte derecha queda libre para el móvil que se superpone. */}
        <div className="mt-3 flex flex-col gap-2 sm:mr-40">
          <div className="flex items-center gap-2 rounded-xl bg-danger-soft px-3 py-2 text-xs text-danger-ink">
            <span className="h-2 w-2 flex-none rounded-full bg-danger" /> Sábado noche: falta 1 en barra
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-ok-soft px-3 py-2 text-xs text-accent">
            <span className="h-2 w-2 flex-none rounded-full bg-accent" /> Descansos de 12 h y días libres: todo en regla
          </div>
        </div>
      </div>

      <div className="absolute -bottom-24 -right-3 hidden w-40 rotate-[3deg] rounded-[26px] border-[6px] border-ink bg-surface p-3 shadow-xl sm:block">
        <div className="text-[10px] text-ink-muted">Hola, Laura</div>
        <div className="mt-1 rounded-xl bg-accent p-2.5 text-white">
          <div className="text-[9px] uppercase tracking-wide opacity-80">Hoy · miércoles</div>
          <div className="font-display text-lg font-bold leading-tight">17:00 – 01:00</div>
          <div className="text-[10px]">Noche</div>
        </div>
        <div className="mt-2 space-y-1">
          {["Jue · Libre", "Vie · 17:00 – 01:00"].map((t) => (
            <div key={t} className="rounded-lg border border-line px-2 py-1 text-[9px]">
              {t}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
