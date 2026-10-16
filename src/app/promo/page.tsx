import type { Metadata } from "next";
import { Suspense } from "react";
import { PromoFilm } from "./PromoFilm";

export const metadata: Metadata = {
  title: "Rotafy — Vídeo",
  robots: { index: false, follow: false },
};

type Params = Promise<{ render?: string }>;

/** El vídeo promocional, pintado con la propia interfaz (ver PromoFilm). Con ?render=1 se queda quieto para capturarlo. */
export default function PromoPage({ searchParams }: { searchParams: Params }) {
  return (
    <Suspense fallback={null}>
      <Film searchParams={searchParams} />
    </Suspense>
  );
}

async function Film({ searchParams }: { searchParams: Params }) {
  const { render } = await searchParams;
  return <PromoFilm render={render !== undefined} />;
}
