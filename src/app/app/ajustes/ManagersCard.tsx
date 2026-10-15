"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useConfirm } from "@/components/feedback";
import { ui } from "@/components/ui";
import { whatsappLink } from "@/lib/whatsapp";
import { createInvite, leaveLocal, loadManagers, removeManager, revokeInvite, type ManagersInfo } from "./actions";

/**
 * Quién gestiona el negocio. El dueño invita a otros encargados con un enlace
 * (como el de los empleados, pero para gestionar) y puede quitarlos.
 */
export function ManagersCard({ localName, onDone, onError }: { localName: string; onDone: (m: string) => void; onError: (m: string) => void }) {
  const [info, setInfo] = useState<ManagersInfo | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const { confirm, view: confirmView } = useConfirm();

  const reload = useCallback(async () => {
    const res = await loadManagers();
    if (res.ok) setInfo(res.data);
  }, []);

  useEffect(() => {
    start(reload);
  }, [reload]);

  function invite() {
    start(async () => {
      const res = await createInvite();
      if (!res.ok) return onError(res.error);
      setFresh(res.link);
      await reload();
    });
  }

  async function copy(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      onDone("Enlace copiado.");
    } catch {
      onError("No se ha podido copiar. Selecciónalo y cópialo a mano.");
    }
  }

  async function remove(userId: string, email: string | null) {
    const ok = await confirm({ title: `¿Quitar a ${email ?? "este encargado"}?`, body: "Dejará de ver y gestionar el negocio al momento.", confirmLabel: "Quitar", danger: true });
    if (!ok) return;
    start(async () => {
      const res = await removeManager(userId);
      if (!res.ok) return onError(res.error);
      onDone("Encargado quitado.");
      await reload();
    });
  }

  async function leave() {
    const ok = await confirm({ title: `¿Dejar de gestionar «${localName}»?`, body: "Dejarás de ver el negocio. Para volver, te tendrán que invitar otra vez.", confirmLabel: "Salir del negocio", danger: true });
    if (!ok) return;
    start(async () => {
      const res = await leaveLocal();
      if (res && !res.ok) onError(res.error);
    });
  }

  const message = (link: string) => `Te invito a gestionar los turnos de ${localName} en Rotafy. Entra aquí (vale 7 días): ${link}`;

  return (
    <section className={`${ui.card} p-6`}>
      <h2 className={ui.h2}>Encargados</h2>
      <p className="mt-1 text-sm text-ink-soft">Las personas que pueden hacer el cuadrante, gestionar el equipo y revisar los fichajes.</p>

      {!info ? (
        <div className="mt-4 h-24 animate-pulse rounded-xl bg-ground" />
      ) : (
        <>
          <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
            <li className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-semibold">
                  {info.owner.email ?? "Dueño"} {info.owner.isMe && <span className="font-normal text-ink-muted">(tú)</span>}
                </span>
                <span className="text-[13px] text-ink-muted">Dueño de la cuenta</span>
              </span>
            </li>
            {info.members.map((m) => (
              <li key={m.userId} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-semibold">
                    {m.email ?? "Encargado"} {m.isMe && <span className="font-normal text-ink-muted">(tú)</span>}
                  </span>
                  <span className="text-[13px] text-ink-muted">Encargado</span>
                </span>
                {info.isOwner && (
                  <button type="button" onClick={() => remove(m.userId, m.email)} disabled={pending} className={`${ui.btnSm} ${ui.danger}`}>
                    Quitar
                  </button>
                )}
                {m.isMe && (
                  <button type="button" onClick={leave} disabled={pending} className={`${ui.btnSm} ${ui.secondary}`}>
                    Salir
                  </button>
                )}
              </li>
            ))}
          </ul>

          {fresh && (
            <div className="mt-4 rounded-xl bg-accent-soft p-4">
              <div className="text-sm font-semibold text-accent-ink">Invitación creada</div>
              <p className="mt-0.5 text-[13px] text-accent-ink/80">Mándasela a la persona. Vale 7 días y una sola vez; entrará con su propio email o con Google.</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-lg bg-surface px-3 py-2.5 text-sm">{fresh}</code>
                <button type="button" onClick={() => copy(fresh)} className={`${ui.btnSm} ${ui.secondary}`}>
                  Copiar
                </button>
                <a href={whatsappLink(message(fresh))} target="_blank" rel="noopener noreferrer" className={`${ui.btnSm} ${ui.whatsapp}`}>
                  WhatsApp
                </a>
              </div>
            </div>
          )}

          {info.invites.length > 0 && (
            <div className="mt-4">
              <div className="mb-1.5 text-[13px] font-semibold text-ink-muted">Invitaciones sin usar</div>
              <ul className="flex flex-col gap-1.5">
                {info.invites.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-3 rounded-lg bg-ground px-3 py-2 text-[13px]">
                    <span className="min-w-0 truncate">
                      Caduca el {new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", timeZone: "Europe/Madrid" }).format(new Date(i.expires))}
                    </span>
                    <span className="flex flex-none gap-3">
                      <button type="button" onClick={() => copy(i.link)} className="font-semibold text-accent hover:underline">
                        Copiar enlace
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          start(async () => {
                            const res = await revokeInvite(i.id);
                            if (!res.ok) return onError(res.error);
                            if (fresh === i.link) setFresh(null);
                            await reload();
                          })
                        }
                        className="font-semibold text-ink-muted hover:text-danger-ink"
                      >
                        Anular
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button type="button" onClick={invite} disabled={pending} className={`${ui.btn} ${ui.secondary} mt-4`}>
            + Invitar a otro encargado
          </button>
        </>
      )}
      {confirmView}
    </section>
  );
}
