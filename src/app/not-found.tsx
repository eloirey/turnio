import Link from "next/link";
import { Logo } from "@/components/Logo";
import { ui } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 bg-ground px-6 text-center">
      <Logo />
      <h1 className={ui.h1}>Esta página no existe</h1>
      <p className="max-w-sm text-ink-soft">Puede que el enlace esté mal escrito o que la página se haya movido.</p>
      <Link href="/" className={`${ui.btn} ${ui.primary}`}>
        Volver al inicio
      </Link>
    </main>
  );
}
