"use client";

import { useCallback } from "react";
import { AvisosBell } from "@/components/avisos/AvisosBell";
import type { Aviso } from "@/lib/avisos";
import { loadEmployeeAvisos, readEmployeeAvisos } from "./actions";

/** Campanita del empleado: cambios de horario, respuestas a sus solicitudes, fichajes. */
export function EmployeeAvisos({ token, initial }: { token: string; initial: { items: Aviso[]; unread: number } }) {
  const load = useCallback(() => loadEmployeeAvisos(token), [token]);
  const markRead = useCallback(() => readEmployeeAvisos(token), [token]);
  return (
    <AvisosBell
      load={load}
      markRead={markRead}
      initial={initial}
      emptyText="Aquí verás cuándo se publica o cambia tu horario y las respuestas a lo que pidas."
    />
  );
}
