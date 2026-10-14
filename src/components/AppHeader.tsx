"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  badge?: number;
}

interface Props {
  localName: string;
  nav: NavItem[];
  /** Server action para cerrar sesión (no hay en la demo). */
  signOut?: () => Promise<void>;
}

export function AppHeader({ localName, nav, signOut }: Props) {
  const pathname = usePathname();
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line bg-surface px-4 py-3.5 sm:px-8">
      <div className="flex flex-wrap items-center gap-6">
        <Link href="/" className="font-display text-2xl font-bold tracking-tight text-accent">
          turnio
        </Link>
        <nav aria-label="Principal" className="flex flex-wrap gap-1 text-sm">
          {nav.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center gap-1.5 rounded-lg px-3.5 ${active ? "bg-accent-soft font-semibold text-accent-ink" : "text-ink-soft hover:bg-ground"}`}
              >
                {item.label}
                {item.badge ? (
                  <span className="rounded-full bg-danger px-1.5 text-xs font-semibold text-white">{item.badge}</span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="flex items-center gap-3 text-sm text-ink-soft">
        <span>{localName}</span>
        {signOut && (
          <form action={signOut}>
            <button type="submit" className="min-h-11 rounded-lg px-3 hover:bg-ground">
              Salir
            </button>
          </form>
        )}
      </div>
    </header>
  );
}
