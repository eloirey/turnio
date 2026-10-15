"use client";

import { useActionState } from "react";
import { ui } from "@/components/ui";
import { acceptInvite, type AcceptState } from "./actions";

export function AcceptForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<AcceptState, FormData>(() => acceptInvite(token), {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <button type="submit" disabled={pending} className={`${ui.btn} ${ui.primary} h-12 w-full text-base`}>
        {pending ? "Un momento…" : "Aceptar y entrar"}
      </button>
      {state.error && (
        <p className={ui.error} role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
