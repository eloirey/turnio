import Link from "next/link";
import { Logo, LogoMark } from "@/components/Logo";
import { ui } from "@/components/ui";
import { PALETTE } from "@/lib/roles";
import { SECTOR_TEMPLATES } from "@/lib/schedule/templates";
import { ClockPreview, HeroPreview, RulesPreview, ShiftsPreview, WhatsAppPreview } from "./_landing/Previews";

export const metadata = {
  title: "Rotafy — El cuadrante de turnos en 1 minuto, con fichaje incluido",
  description:
    "Genera el cuadrante semanal respetando disponibilidad, contratos y descansos, y lleva el registro de jornada desde el móvil. Cada empleado recibe su horario por WhatsApp. Sin instalar nada.",
};

const SECTORS = SECTOR_TEMPLATES.filter((t) => t.key !== "otro");

const PAINS = [
  ["Una tarde entera con el Excel", "Un cuadrante listo en segundos"],
  ["“¿Cuál es el horario bueno?”", "Un enlace por persona, siempre al día"],
  ["Hojas de firmas para el fichaje", "Fichan desde el móvil y tú lo exportas"],
  ["El sábado falta alguien en barra", "Lo ves en rojo antes de publicar"],
  ["Cambios que nadie se entera", "Avisa solo a quien le cambia el horario"],
  ["Peticiones por WhatsApp a deshoras", "Solicitudes ordenadas y un aviso en la campanita"],
];

const MORE = [
  { icon: "bell", title: "Avisos en el móvil", text: "Una campanita para ti y otra para cada empleado, y si queréis, notificación en el móvil al momento." },
  { icon: "send", title: "WhatsApp o Telegram", text: "Mandas a cada uno su horario con un toque, por la app que uséis. Si cambia, solo a quien le afecta." },
  { icon: "sheet", title: "Exporta a Excel", text: "El cuadrante con colores, por día o en lista para la gestoría. Y los fichajes del mes." },
  { icon: "swap", title: "Cambios ordenados", text: "Quien quiere librar o cambiarse lo pide desde su enlace. Tú aceptas con un toque." },
  { icon: "plane", title: "Vacaciones y bajas", text: "Apúntalas y el generador no pondrá turnos esos días." },
  { icon: "team", title: "Varios encargados", text: "Invita a quien te ayuda con un enlace. Cada uno entra con su cuenta y lo quitas cuando quieras." },
  { icon: "compass", title: "Ayuda en cada pantalla", text: "Dudas resueltas donde estás y una guía paso a paso para empezar." },
  { icon: "lock", title: "Tus datos, en Europa", text: "Acceso cifrado y cada negocio solo ve lo suyo. Entra con email o con Google." },
] as const;

const FAQ = [
  ["¿Mis empleados tienen que instalar algo?", "No. Cada persona recibe un enlace personal que se abre en el navegador del móvil. Ahí ve su horario, ficha, descarga su registro y, si quiere, lo añade a su calendario o activa los avisos."],
  ["¿Sirve para mi tipo de negocio?", "Sí, si tu equipo trabaja por turnos. Empiezas con una plantilla de tu sector o, si no está, desde cero: tú pones los puestos, las franjas (con el nombre y horario que uséis) y cuánta gente necesitas cada día."],
  ["¿Cumple la normativa laboral?", "Rotafy aplica los descansos entre jornadas, los días libres, los cierres seguidos y las horas extra que configures, también reglas distintas por persona. La responsabilidad final del cuadrante sigue siendo de la empresa."],
  ["¿Sirve como registro de jornada?", "Sí. Cada persona ficha entrada y salida desde su enlace; la hora la pone el servidor, no el móvil. Las correcciones quedan guardadas con su motivo y la hora original, y exportas cada mes en Excel para la gestoría o la Inspección."],
  ["¿Puedo saber si fichan desde el local?", "Sí, si lo activas. Al fichar se mira el GPS del móvil o la wifi del local y tú eliges si solo te avisa o si no deja fichar desde fuera. No se guarda la ubicación, solo si estaba en el local, y a quien teletrabaja le dejas fichar desde casa."],
  ["¿Rotafy guarda los fichajes por mí?", "Los mantiene mientras tengas la cuenta, pero Rotafy no es un archivo: conservar el registro cuatro años es obligación de tu empresa. Descarga el Excel cada mes (un clic) y guárdalo tú o mándalo a tu gestoría."],
  ["¿Cómo se enteran de los cambios de horario?", "Cuando vuelves a publicar, a quien le cambia algo le llega un aviso en su enlace y, si quieres, un mensaje por WhatsApp o Telegram que empieza con «Ha cambiado tu horario». Al resto no hace falta escribirles."],
  ["¿Qué pasa si un empleado comparte su enlace?", "El enlace es único para cada persona. Si lo pierde o lo comparte, lo cambias con un toque y el anterior deja de funcionar al momento."],
  ["¿Cuánto cuesta?", "Ahora mismo es gratis mientras dure el piloto, sin tarjeta. Si en el futuro pasa a ser de pago, te avisaremos antes y podrás decidir con calma."],
];

export default function Home() {
  return (
    <div className="min-h-screen overflow-x-clip bg-ground text-ink">
      <header className="sticky top-0 z-30 border-b border-line/60 bg-ground/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <Link href="/" aria-label="Rotafy">
            <Logo size="sm" />
          </Link>
          <nav className="hidden items-center gap-1 text-sm font-medium text-ink-soft md:flex">
            <a href="#cuadrante" className="rounded-lg px-3 py-2 hover:text-ink">
              Cuadrante
            </a>
            <a href="#fichaje" className="rounded-lg px-3 py-2 hover:text-ink">
              Fichaje
            </a>
            <a href="#sectores" className="rounded-lg px-3 py-2 hover:text-ink">
              Sectores
            </a>
            <a href="#preguntas" className="rounded-lg px-3 py-2 hover:text-ink">
              Preguntas
            </a>
          </nav>
          <nav className="flex items-center gap-1 text-sm">
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
        <section className="relative">
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-0 overflow-hidden">
            <div className="absolute -top-40 left-1/2 h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(31,92,70,0.16),transparent)]" />
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(27,27,26,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(27,27,26,0.045)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" />
          </div>
          <div className="relative mx-auto grid grid-cols-1 max-w-6xl items-center gap-14 px-5 pb-24 pt-14 lg:grid-cols-[1fr_1.05fr] lg:pt-20">
            <div>
              <a
                href="#mas"
                className="mb-6 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-surface/80 py-1 pl-1 pr-3 text-[13px] font-medium text-accent-ink shadow-sm backdrop-blur hover:border-accent/40"
              >
                <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">Nuevo</span>
                Avisos en el móvil y varios encargados <span aria-hidden>→</span>
              </a>
              <h1 className="font-display text-[42px] font-bold leading-[1.08] tracking-[-0.03em] sm:text-[64px]">
                El cuadrante de la semana en{" "}
                <span className="relative whitespace-nowrap text-accent">
                  1 minuto
                  <svg aria-hidden viewBox="0 0 220 14" className="absolute -bottom-1 left-0 h-3 w-full text-accent/35" preserveAspectRatio="none">
                    <path d="M2 10 C 60 2, 150 2, 218 9" stroke="currentColor" strokeWidth="5" fill="none" strokeLinecap="round" />
                  </svg>
                </span>
                . <span className="text-ink-muted/80">No en una tarde.</span>
              </h1>
              <p className="mt-7 max-w-xl text-lg leading-relaxed text-ink-soft sm:text-xl">
                Se acabaron el Excel, la foto del horario en el grupo y el «¿quién cierra el sábado?». Rotafy reparte los turnos cumpliendo descansos y
                contratos, avisa a cada persona en su móvil y lleva el <strong className="font-semibold text-ink">registro de jornada que exige la ley</strong>.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link href="/login" className={`${ui.btn} ${ui.primary} h-[52px] px-7 text-base shadow-[0_10px_30px_-10px_rgba(31,92,70,0.7)]`}>
                  Crear mi cuadrante gratis
                </Link>
                <Link href="/demo" className={`${ui.btn} ${ui.secondary} h-[52px] px-7 text-base`}>
                  <PlayIcon /> Probar la demo guiada
                </Link>
              </div>
              <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-soft">
                {["Sin tarjeta", "Tu equipo no instala nada", "Datos en Europa"].map((t) => (
                  <li key={t} className="flex items-center gap-1.5">
                    <CheckIcon /> {t}
                  </li>
                ))}
              </ul>
            </div>
            <HeroPreview />
          </div>
        </section>

        {/* ---------- Cifras ---------- */}
        <section className="border-y border-line bg-surface">
          <dl className="mx-auto grid max-w-6xl grid-cols-2 divide-line px-5 md:grid-cols-4 md:divide-x">
            {[
              ["< 1 min", "para generar la semana"],
              [String(SECTORS.length), "plantillas por sector"],
              ["0 apps", "que instalar en el equipo"],
              ["1 clic", "para el Excel de fichajes"],
            ].map(([n, l]) => (
              <div key={l} className="px-2 py-7 md:px-8">
                <dt className="sr-only">{l}</dt>
                <dd className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{n}</dd>
                <dd className="mt-1 text-sm text-ink-muted">{l}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ---------- Antes / después ---------- */}
        <section className="mx-auto max-w-6xl px-5 py-24">
          <SectionTitle kicker="Lo que cambia" title="Lo que deja de pasar cada semana" />
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {PAINS.map(([before, after]) => (
              <div key={before} className="group flex items-start gap-4 rounded-2xl border border-line bg-surface p-6 transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-24px_rgba(27,27,26,0.35)]">
                <span className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-full bg-accent-soft text-accent">
                  <CheckIcon />
                </span>
                <div>
                  <p className="text-ink-muted line-through decoration-danger/50">{before}</p>
                  <p className="mt-1 text-lg font-semibold">{after}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ---------- Cuadrante ---------- */}
        <section id="cuadrante" className="scroll-mt-20 border-y border-line bg-surface">
          <div className="mx-auto grid grid-cols-1 max-w-6xl items-center gap-14 px-5 py-24 lg:grid-cols-2">
            <div>
              <SectionTitle kicker="Cuadrante automático" title="Pulsa un botón y tienes la semana hecha" />
              <p className="mt-5 text-lg leading-relaxed text-ink-soft">
                Rotafy prueba muchas combinaciones y se queda con la que cubre todo lo que necesitas y reparte mejor las noches, los cierres y los fines de
                semana. Si algo no cuadra, lo ves en rojo antes de publicar.
              </p>
              <ul className="mt-7 grid gap-3.5">
                <Bullet>Respeta disponibilidad, horas de contrato, vacaciones y bajas.</Bullet>
                <Bullet>Tus reglas: descanso entre jornadas, días libres, cierres seguidos, horas extra.</Bullet>
                <Bullet>Reglas propias por persona y días que prefiere librar.</Bullet>
                <Bullet>Retocas tocando una casilla, y puedes deshacer cualquier cambio grande.</Bullet>
              </ul>
            </div>
            <RulesPreview />
          </div>
        </section>

        {/* ---------- A tu medida ---------- */}
        <section className="mx-auto grid grid-cols-1 max-w-6xl items-center gap-14 px-5 py-24 lg:grid-cols-2">
          <ShiftsPreview />
          <div className="lg:order-first">
            <SectionTitle kicker="A tu medida" title="Tus franjas, tus puestos, tus nombres" />
            <p className="mt-5 text-lg leading-relaxed text-ink-soft">
              ¿Mañana, tarde y noche? ¿Turno partido? ¿«Línea 12» para un conductor? Llama a cada franja como la llamáis vosotros, con su horario, y marca cuáles
              son de cierre. Hasta ocho por negocio.
            </p>
            <ul className="mt-7 grid gap-3.5">
              <Bullet>Empiezas con la plantilla de tu sector y la cambias en un minuto.</Bullet>
              <Bullet>Puestos con su color: sala, cocina, caja, auxiliares…</Bullet>
              <Bullet>Cuánta gente de cada puesto necesitas en cada franja y día.</Bullet>
            </ul>
          </div>
        </section>

        {/* ---------- Fichaje ---------- */}
        <section id="fichaje" className="scroll-mt-16 bg-ink text-white">
          <div className="relative mx-auto max-w-6xl px-5 py-24">
            <div aria-hidden className="pointer-events-none absolute right-0 top-10 h-80 w-80 rounded-full bg-[radial-gradient(closest-side,rgba(143,211,176,0.18),transparent)]" />
            <div className="relative grid grid-cols-1 items-center gap-14 lg:grid-cols-[1fr_1.1fr]">
              <div>
                <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[#8FD3B0]">Registro de jornada</p>
                <h2 className="mt-3 font-display text-4xl font-bold tracking-tight sm:text-5xl">Fichan desde el móvil. Tú lo ves todo.</h2>
                <p className="mt-5 text-lg leading-relaxed text-white/75">
                  Cada persona ficha la entrada y la salida desde su enlace, sin instalar nada. En el cuadrante ves a qué hora fichó cada uno, debajo de su turno.
                </p>
                <ul className="mt-8 grid gap-4">
                  {[
                    ["Hora del servidor", "No vale cambiar la hora del móvil."],
                    ["Desde el local", "Comprueba que fichan en el local (o en su día de teletrabajo), sin guardar dónde están."],
                    ["Olvidos resueltos", "Si alguien no ficha la salida, lo corriges y queda guardado el motivo y la hora original."],
                    ["Horas reales de cada uno", "Totales por semana y quién está trabajando ahora."],
                    ["Excel para la gestoría", "El registro del mes en un clic, para guardar tu copia o enseñarlo a la Inspección."],
                  ].map(([t, d]) => (
                    <li key={t} className="flex gap-3.5">
                      <span className="mt-1 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-[#8FD3B0]/15 text-[#8FD3B0]">
                        <CheckIcon />
                      </span>
                      <span>
                        <strong className="font-semibold">{t}.</strong> <span className="text-white/70">{d}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <ClockPreview />
            </div>
          </div>
        </section>

        {/* ---------- Enlace personal ---------- */}
        <section className="border-b border-line bg-surface">
          <div className="mx-auto grid grid-cols-1 max-w-6xl items-center gap-14 px-5 py-24 lg:grid-cols-2">
            <div>
              <SectionTitle kicker="Para tu equipo" title="Un enlace por persona. Nada que instalar." />
              <p className="mt-5 text-lg leading-relaxed text-ink-soft">
                Al publicar, mandas a cada uno su horario por WhatsApp o Telegram con un toque. En su enlace lo tiene siempre al día, ficha, pide cambios y
                recibe avisos. Si quiere, sus turnos aparecen solos en el calendario del móvil.
              </p>
              <ul className="mt-7 grid gap-3.5">
                <Bullet>Único para cada persona: si se comparte, lo cambias y el anterior deja de funcionar.</Bullet>
                <Bullet>Se suscribe una vez al calendario (iPhone, Google, Outlook) y se actualiza solo.</Bullet>
                <Bullet>Pide librar o cambiarse con un compañero, sin mensajes por privado, y le avisa la campanita cuando respondes.</Bullet>
              </ul>
            </div>
            <WhatsAppPreview />
          </div>
        </section>

        {/* ---------- Más ---------- */}
        <section id="mas" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-24">
          <SectionTitle kicker="Y además" title="Los detalles que ahorran discusiones" />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {MORE.map((f) => (
              <div key={f.title} className="rounded-2xl border border-line bg-surface p-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
                  <FeatureIcon name={f.icon} />
                </span>
                <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
                <p className="mt-1 leading-relaxed text-ink-soft">{f.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---------- Cómo funciona ---------- */}
        <section className="border-y border-line bg-surface">
          <div className="mx-auto max-w-6xl px-5 py-24">
            <SectionTitle kicker="Cómo empezar" title="Listo en diez minutos" />
            <ol className="relative mt-12 grid gap-10 md:grid-cols-3 md:gap-6">
              <div aria-hidden className="absolute left-5 right-[16%] top-5 hidden h-px bg-line-strong md:block" />
              {[
                ["Elige tu sector", "Te creamos franjas, puestos y necesidades típicas. Lo cambias todo cuando quieras."],
                ["Añade a tu equipo", "Nombre, puesto, horas de contrato y cuándo puede trabajar. Solo la primera vez."],
                ["Genera, publica y ficha", "Retocas, publicas y cada uno recibe su horario. Si lo activas, empiezan a fichar."],
              ].map(([t, d], i) => (
                <li key={t} className="relative">
                  <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-accent font-display text-lg font-bold text-white ring-8 ring-surface">
                    {i + 1}
                  </span>
                  <h3 className="mt-5 font-display text-2xl font-bold">{t}</h3>
                  <p className="mt-2 leading-relaxed text-ink-soft">{d}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ---------- Sectores ---------- */}
        <section id="sectores" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-24">
          <SectionTitle kicker="Plantillas" title="Para cualquier equipo con turnos" />
          <p className="mt-4 max-w-2xl text-lg text-ink-soft">Elige tu sector al crear la cuenta y empiezas con todo preparado. ¿No está el tuyo? Empiezas desde cero y lo creas a tu manera.</p>
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {SECTORS.map((s, i) => (
              <div key={s.key} className="flex items-start gap-3 rounded-xl border border-line bg-surface p-4">
                <span className="mt-1 h-3 w-3 flex-none rounded-[4px]" style={{ backgroundColor: PALETTE[i % PALETTE.length].fg }} />
                <div className="min-w-0">
                  <div className="font-semibold leading-snug">{s.label}</div>
                  <div className="mt-0.5 text-sm text-ink-muted">{s.hint}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ---------- Demo ---------- */}
        <section className="mx-auto max-w-6xl px-5 pb-24">
          <div className="relative overflow-hidden rounded-3xl border border-line bg-surface px-7 py-12 sm:px-12">
            <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-[radial-gradient(closest-side,rgba(31,92,70,0.14),transparent)]" />
            <div className="relative flex flex-wrap items-center justify-between gap-8">
              <div className="max-w-xl">
                <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Pruébalo ahora, sin registrarte</h2>
                <p className="mt-3 text-lg text-ink-soft">
                  La demo es la app de verdad con un equipo de ejemplo. Una guía te lleva paso a paso: generar, publicar, avisar y revisar fichajes.
                </p>
              </div>
              <Link href="/demo" className={`${ui.btn} ${ui.secondary} h-[52px] px-7 text-base`}>
                <PlayIcon /> Abrir la demo guiada
              </Link>
            </div>
          </div>
        </section>

        {/* ---------- Preguntas ---------- */}
        <section id="preguntas" className="scroll-mt-16 border-t border-line bg-surface">
          <div className="mx-auto max-w-3xl px-5 py-24">
            <SectionTitle kicker="Dudas" title="Preguntas frecuentes" />
            <div className="mt-8 divide-y divide-line border-y border-line">
              {FAQ.map(([q, a]) => (
                <details key={q} className="group py-4">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold">
                    {q}
                    <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full border border-line-strong text-xl text-ink-muted transition group-open:rotate-45" aria-hidden="true">
                      +
                    </span>
                  </summary>
                  <p className="mt-2 pr-10 leading-relaxed text-ink-soft">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- Llamada final ---------- */}
        <section className="mx-auto max-w-6xl px-5 py-20">
          <div className="relative overflow-hidden rounded-3xl bg-accent px-7 py-14 text-white sm:px-14">
            <div aria-hidden className="pointer-events-none absolute -bottom-24 -right-10 h-80 w-80 rounded-full bg-[radial-gradient(closest-side,rgba(255,255,255,0.14),transparent)]" />
            <h2 className="relative max-w-2xl font-display text-4xl font-bold tracking-tight sm:text-5xl">Haz el cuadrante de la semana que viene con Rotafy.</h2>
            <p className="relative mt-4 max-w-xl text-lg text-white/85">Configurarlo lleva diez minutos. Si no te ahorra tiempo, vuelves al Excel.</p>
            <div className="relative mt-8 flex flex-wrap gap-3">
              <Link href="/login" className={`${ui.btn} h-[52px] bg-white px-7 text-base text-accent-ink hover:bg-ground`}>
                Crear mi cuenta gratis
              </Link>
              <Link href="/demo" className={`${ui.btn} h-[52px] border border-white/30 px-7 text-base text-white hover:bg-white/10`}>
                Ver la demo
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-sm text-ink-muted">
          <span className="flex items-center gap-2">
            <LogoMark size={20} /> Rotafy · Cuadrantes de turnos y fichaje
          </span>
          <nav className="flex flex-wrap gap-5">
            <Link href="/legal/privacidad" className="hover:text-ink">
              Privacidad
            </Link>
            <Link href="/legal/cookies" className="hover:text-ink">
              Cookies
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

// ---------- Piezas ----------

function SectionTitle({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div>
      <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-accent">{kicker}</p>
      <h2 className="mt-3 max-w-2xl font-display text-4xl font-bold tracking-tight sm:text-5xl">{title}</h2>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3 text-[16px] leading-relaxed">
      <span className="mt-1 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-accent text-white">
        <CheckIcon small />
      </span>
      <span>{children}</span>
    </li>
  );
}

function CheckIcon({ small }: { small?: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className={small ? "h-3 w-3" : "h-4 w-4"} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 8.5l3 3 6-7" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
      <path d="M5 3.2v9.6a.6.6 0 00.9.5l7.6-4.8a.6.6 0 000-1L5.9 2.7a.6.6 0 00-.9.5z" />
    </svg>
  );
}

function FeatureIcon({ name }: { name: (typeof MORE)[number]["icon"] }) {
  const paths: Record<typeof name, React.ReactNode> = {
    plane: <path d="M2.5 13.5l17-7-4 14-4.5-5.5-5.5-.5zM11 15l8.5-8.5" />,
    bell: (
      <>
        <path d="M5.5 9a5.5 5.5 0 0111 0c0 4 1.6 5.6 2.3 6.2H3.2C3.9 14.6 5.5 13 5.5 9z" />
        <path d="M9 18.5a2 2 0 004 0" />
      </>
    ),
    send: <path d="M3 10.5l16-7-6 16-2.5-6.5L3 10.5zM10.5 13l8.5-9.5" />,
    sheet: (
      <>
        <rect x="3.5" y="3.5" width="15" height="15" rx="2" />
        <path d="M3.5 8.5h15M3.5 13.5h15M8.5 8.5v10" />
      </>
    ),
    swap: <path d="M4 8h14l-4-4M18 14H4l4 4" />,
    team: (
      <>
        <circle cx="8" cy="8" r="3" />
        <path d="M2.5 18a5.5 5.5 0 0111 0" />
        <circle cx="15.5" cy="7" r="2.5" />
        <path d="M15 12.5a4.5 4.5 0 014.5 4.5" />
      </>
    ),
    compass: (
      <>
        <circle cx="11" cy="11" r="8.5" />
        <path d="M14.5 7.5l-2 5-5 2 2-5z" />
      </>
    ),
    lock: (
      <>
        <rect x="4" y="10" width="14" height="9" rx="2" />
        <path d="M7.5 10V7a3.5 3.5 0 017 0v3" />
      </>
    ),
  };
  return (
    <svg aria-hidden viewBox="0 0 22 22" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}
