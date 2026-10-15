"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "@/components/nav";
import { safeAvisoLink, timeAgo, type Aviso, type AvisoTipo } from "@/lib/avisos";

type LoadResult = { ok: true; items: Aviso[]; unread: number } | { ok: false };

interface Props {
  load: () => Promise<LoadResult>;
  markRead: () => Promise<unknown>;
  initial?: { items: Aviso[]; unread: number };
  /** Texto cuando no hay avisos. */
  emptyText?: string;
  /** Cada cuánto se miran avisos nuevos (0 = nunca). */
  pollMs?: number;
}

const KIND: Record<AvisoTipo, { label: string; dot: string }> = {
  solicitud: { label: "Solicitud", dot: "bg-[#E08A00]" },
  solicitud_resuelta: { label: "Solicitud", dot: "bg-accent" },
  horario: { label: "Horario", dot: "bg-[#2F6FB5]" },
  fichaje: { label: "Fichaje", dot: "bg-danger" },
  anuncio: { label: "Novedad de Rotafy", dot: "bg-ink" },
};

/** Campanita con los avisos. Se actualiza sola cada minuto y al volver a la pestaña. */
export function AvisosBell({ load, markRead, initial, emptyText = "No tienes avisos.", pollMs = 60_000 }: Props) {
  const [items, setItems] = useState<Aviso[]>(initial?.items ?? []);
  const [unread, setUnread] = useState(initial?.unread ?? 0);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const router = useRouter();

  const lastUnread = useRef(initial?.unread ?? 0);
  const refresh = useCallback(async () => {
    try {
      const res = await load();
      if (!res.ok) return;
      setItems(res.items);
      setUnread(res.unread);
      // Si ha llegado algo nuevo, la pantalla se actualiza (por ejemplo, una solicitud en el cuadrante).
      if (res.unread > lastUnread.current && !navigate) router.refresh();
      lastUnread.current = res.unread;
    } catch {
      // sin conexión: ya lo intentará otra vez
    }
  }, [load, navigate, router]);

  useEffect(() => {
    const first = initial ? undefined : window.setTimeout(refresh, 0);
    const timer = pollMs ? window.setInterval(refresh, pollMs) : undefined;
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      if (first) window.clearTimeout(first);
      if (timer) window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh, pollMs, initial]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panelRef.current?.contains(t) && !buttonRef.current?.contains(t)) setOpen(false);
    };
    const onResize = () => setOpen(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  function toggle() {
    if (open) return setOpen(false);
    const r = buttonRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 8, right: window.innerWidth < 640 ? 12 : Math.max(12, window.innerWidth - r.right) });
    setOpen(true);
    if (unread > 0) {
      // Se marcan como leídos, pero se siguen viendo resaltados mientras está abierto.
      setUnread(0);
      lastUnread.current = 0;
      markRead().catch(() => undefined);
    }
  }

  function go(link: string) {
    setOpen(false);
    if (/^https:\/\//.test(link)) window.open(link, "_blank", "noopener,noreferrer");
    else if (navigate) navigate(link);
    // Ya estás en esa pantalla: se vuelve a cargar para ver lo último.
    else if (link === window.location.pathname + window.location.search) router.refresh();
    else router.push(link);
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={unread ? `Avisos: ${unread} sin leer` : "Avisos"}
        className={`relative flex h-10 w-10 flex-none items-center justify-center rounded-lg ${open ? "bg-accent-soft text-accent-ink" : "text-ink-soft hover:bg-ground hover:text-ink"}`}
      >
        <svg aria-hidden viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9.5a6 6 0 0112 0c0 4.5 1.8 6.2 2.5 6.8H3.5c.7-.6 2.5-2.3 2.5-6.8z" />
          <path d="M10 19.5a2.2 2.2 0 004 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[11px] font-bold leading-none text-white ring-2 ring-surface">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Avisos"
            style={{ top: pos.top, right: pos.right }}
            className="fixed z-50 flex max-h-[min(560px,calc(100vh-90px))] w-[min(390px,calc(100vw-24px))] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_24px_60px_-20px_rgba(27,27,26,0.45)] print:hidden"
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="font-display text-lg font-bold">Avisos</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar avisos" className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted hover:bg-ground hover:text-ink">
                ✕
              </button>
            </div>
            {items.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm leading-relaxed text-ink-muted">{emptyText}</p>
            ) : (
              <ul className="flex-1 divide-y divide-line overflow-y-auto">
                {items.map((a) => {
                  const link = safeAvisoLink(a.enlace);
                  const body = (
                    <>
                      <span className={`mt-1.5 h-2.5 w-2.5 flex-none rounded-full ${KIND[a.tipo].dot}`} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2 text-[12px] text-ink-muted">
                          <span className="font-semibold uppercase tracking-[0.06em]">{KIND[a.tipo].label}</span>
                          <span className="flex-none">{timeAgo(a.creadoEn)}</span>
                        </span>
                        <span className={`mt-0.5 block text-[15px] leading-snug ${a.leido ? "font-medium text-ink-soft" : "font-semibold text-ink"}`}>{a.titulo}</span>
                        {a.cuerpo && <span className="mt-0.5 block text-[13px] leading-snug text-ink-muted">{a.cuerpo}</span>}
                        {link && <span className="mt-1 block text-[13px] font-semibold text-accent">Ver →</span>}
                      </span>
                    </>
                  );
                  const cls = `flex w-full gap-3 px-4 py-3 text-left ${a.leido ? "" : "bg-accent-soft/60"}`;
                  return (
                    <li key={a.id}>
                      {link ? (
                        <button type="button" onClick={() => go(link)} className={`${cls} hover:bg-ground`}>
                          {body}
                        </button>
                      ) : (
                        <div className={cls}>{body}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
