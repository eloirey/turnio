import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-ground">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Link href="/" aria-label="Rotafy, inicio">
            <Logo size="sm" />
          </Link>
          <nav className="flex gap-4 text-sm text-ink-soft">
            <Link href="/legal/privacidad" className="hover:text-ink">
              Privacidad
            </Link>
            <Link href="/legal/aviso-legal" className="hover:text-ink">
              Aviso legal
            </Link>
            <Link href="/legal/cookies" className="hover:text-ink">
              Cookies
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-10">
        <article className="prose-legal">{children}</article>
      </main>
    </div>
  );
}
