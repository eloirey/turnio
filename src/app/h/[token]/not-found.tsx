import { LogoMark } from "@/components/Logo";

export default function EmployeeNotFound() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-3 px-6">
      <LogoMark size={36} />
      <h1 className="mt-2 font-display text-[28px] font-bold tracking-tight">Este enlace no funciona</h1>
      <p className="leading-relaxed text-ink-soft">
        Puede que esté mal copiado o que ya no sea válido. Pide a quien organiza los turnos que te lo envíe de nuevo.
      </p>
    </main>
  );
}
