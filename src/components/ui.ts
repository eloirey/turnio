/**
 * Estilos base reutilizables. Son cadenas de clases de Tailwind (no
 * componentes) para poder aplicarlas a <button>, <a> o <Link> por igual.
 */
export const ui = {
  card: "rounded-2xl border border-line bg-surface",
  h1: "font-display text-[34px] font-bold leading-tight tracking-tight",
  h2: "font-display text-xl font-bold",
  label: "flex flex-col gap-1.5 text-sm font-semibold",
  input:
    "h-11 rounded-[10px] border border-line-strong bg-surface px-3 text-[15px] font-normal text-ink outline-none focus:border-ink focus:ring-2 focus:ring-accent/20",
  btn: "inline-flex h-[46px] items-center justify-center gap-2 rounded-[10px] px-5 text-[15px] font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100 disabled:opacity-60",
  primary: "bg-accent text-white hover:bg-accent-ink",
  secondary: "border border-line-strong bg-surface text-ink hover:border-ink",
  /** Colores de cada app para que se reconozcan de un vistazo. */
  whatsapp: "bg-[#128C4B] text-white hover:bg-[#0E7340]",
  telegram: "bg-[#2481CC] text-white hover:bg-[#1C6CAD]",
  danger: "border border-danger/40 bg-surface text-danger-ink hover:border-danger",
  btnSm: "inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100",
  error: "rounded-[10px] bg-danger-soft px-4 py-3 text-sm text-danger-ink",
  success: "rounded-[10px] bg-ok-soft px-4 py-3 text-sm text-accent",
} as const;
