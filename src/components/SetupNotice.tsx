import Link from "next/link";
import { ui } from "./ui";

/** Se muestra en vez de la app cuando faltan las claves de Supabase en .env.local. */
export function SetupNotice() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center gap-5 px-6 py-16">
      <div className="font-display text-2xl font-bold text-accent">rotafy</div>
      <h1 className={ui.h1}>Falta conectar Supabase</h1>
      <ol className="list-decimal space-y-2 pl-5 text-ink-soft">
        <li>Crea un proyecto gratuito en supabase.com (región Europa).</li>
        <li>
          En <strong>SQL Editor</strong>, ejecuta el archivo <code>supabase/migrations/20261014000000_init.sql</code>.
        </li>
        <li>
          Copia <code>.env.example</code> a <code>.env.local</code> y pon tus claves (Project Settings → API).
        </li>
        <li>
          Para la terminal con <kbd>Ctrl</kbd>+<kbd>C</kbd> y vuelve a lanzar <code>npm run dev</code>.
        </li>
      </ol>
      <p className="text-ink-soft">
        Mientras tanto puedes probar la <Link href="/demo" className="font-semibold underline">demo con datos de ejemplo</Link>.
      </p>
    </main>
  );
}
