import Link from "next/link";

export function AppHeader({ localName }: { localName: string }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line bg-surface px-4 py-[18px] sm:px-8">
      <div className="flex flex-wrap items-center gap-6">
        <Link href="/" className="font-display text-2xl font-bold tracking-tight text-accent">
          turnio
        </Link>
        <nav aria-label="Principal" className="flex flex-wrap gap-1 text-sm">
          <Link href="/demo" className="rounded-lg bg-accent-soft px-3.5 py-2.5 font-semibold text-accent-ink">
            Cuadrante
          </Link>
          <span className="rounded-lg px-3.5 py-2.5 text-ink-muted" title="Próximamente">
            Empleados
          </span>
        </nav>
      </div>
      <div className="text-sm text-ink-soft">{localName}</div>
    </header>
  );
}
