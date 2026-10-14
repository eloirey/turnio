/** Marca de Rotafy: dos flechas que rotan (los turnos) dentro de un cuadrado. */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#1F5C46" />
      <path d="M10 13.5a6.5 6.5 0 0 1 11.3-3.9" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M22 18.5a6.5 6.5 0 0 1-11.3 3.9" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M21.9 6.2v4h-4" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10.1 25.8v-4h4" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const px = size === "lg" ? 34 : size === "sm" ? 22 : 28;
  const text = size === "lg" ? "text-3xl" : size === "sm" ? "text-lg" : "text-2xl";
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark size={px} />
      <span className={`font-display font-bold tracking-tight text-ink ${text}`}>rotafy</span>
    </span>
  );
}
