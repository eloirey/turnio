"use client";

import { loadAvisos, readAvisos } from "@/app/app/avisos/actions";
import { AvisosBell } from "./AvisosBell";

/** Campanita del encargado en la cabecera de la app. */
export function AppAvisos() {
  return (
    <AvisosBell
      load={loadAvisos}
      markRead={readAvisos}
      emptyText="Aquí te avisaremos cuando alguien pida librar o un cambio, cuando alguien olvide fichar la salida y de las novedades de Rotafy."
    />
  );
}
