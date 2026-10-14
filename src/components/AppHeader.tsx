"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./Logo";

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
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur print:hidden">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 pt-3 sm:px-8 sm:py-3">
        <div className="flex min-w-0 items-center gap-7">
          <Link href={nav[0]?.href ?? "/"} aria-label="Rotafy, inicio" className="flex-none">
            <Logo size="sm" />
          </Link>
          <nav aria-label="Principal" className="hidden gap-1 text-sm sm:flex">
            {nav.map((item) => (
              <NavLink key={item.href} item={item} active={pathname.startsWith(item.href)} />
            ))}
          </nav>
        </div>
        <div className="flex min-w-0 items-center gap-2 text-sm text-ink-soft">
          <span className="truncate font-medium text-ink">{localName}</span>
          {signOut && (
            <form action={signOut}>
              <button type="submit" className="min-h-11 rounded-lg px-3 text-ink-muted hover:bg-ground hover:text-ink">
                Salir
              </button>
            </form>
          )}
        </div>
      </div>
      {/* En el móvil, la navegación va en una segunda fila que se puede desplazar */}
      <nav aria-label="Principal" className="flex gap-1 overflow-x-auto px-3 pb-2 pt-1 text-sm sm:hidden">
        {nav.map((item) => (
          <NavLink key={item.href} item={item} active={pathname.startsWith(item.href)} />
        ))}
      </nav>
    </header>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-10 flex-none items-center gap-1.5 rounded-lg px-3.5 ${active ? "bg-accent-soft font-semibold text-accent-ink" : "text-ink-soft hover:bg-ground hover:text-ink"}`}
    >
      {item.label}
      {item.badge ? <span className="rounded-full bg-danger px-1.5 text-xs font-semibold text-white">{item.badge}</span> : null}
    </Link>
  );
}
