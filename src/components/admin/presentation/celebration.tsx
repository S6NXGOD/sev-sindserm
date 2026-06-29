"use client";

import { useEffect } from "react";
import type { PresentationLocal } from "@/lib/dashboard";

const MEDALHAS = ["🥇", "🥈", "🥉"];

function PodioColuna({
  pos,
  nome,
  votos,
  altura,
}: {
  pos: number;
  nome?: string;
  votos?: number;
  altura: string;
}) {
  if (!nome) return null;
  const cores = ["bg-yellow-400 text-slate-900", "bg-slate-300 text-slate-900", "bg-amber-700 text-white"];
  return (
    <div className="flex w-40 flex-col items-center justify-end gap-2 sm:w-52">
      <p className="line-clamp-2 text-center text-xl font-extrabold sm:text-2xl">
        {nome}
      </p>
      <p className="text-2xl font-extrabold text-emerald-300">{votos}</p>
      <div
        className={`flex w-full items-center justify-center rounded-t-xl text-4xl font-black ${cores[pos - 1]} ${altura}`}
      >
        {pos}º
      </div>
    </div>
  );
}

export function Celebration({
  local,
  onClose,
  playSound,
}: {
  local: PresentationLocal;
  onClose: () => void;
  playSound: () => void;
}) {
  useEffect(() => {
    playSound();

    let cancelado = false;
    void (async () => {
      try {
        const confetti = (await import("canvas-confetti")).default;
        confetti({ particleCount: 180, spread: 130, origin: { y: 0.5 } });
        const fim = Date.now() + 2800;
        const frame = () => {
          confetti({
            particleCount: 6,
            startVelocity: 45,
            spread: 80,
            gravity: 1.1,
            origin: { x: Math.random(), y: -0.1 },
          });
          if (!cancelado && Date.now() < fim) requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      } catch {
        /* canvas-confetti indisponível — ignora */
      }
    })();

    // Plantão de Apuração: exibe o resultado consolidado por 15 segundos.
    const timer = setTimeout(onClose, 15000);
    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local.id]);

  const poucos = local.eleitosCount > 0 && local.eleitosCount <= 5;
  const eleitos = local.top.slice(0, Math.min(local.eleitosCount, 5));
  const podio = local.top.slice(0, 3);
  const restantes = local.eleitosCount - podio.length;
  const vagasLabel = `${local.vagas} ${local.vagas === 1 ? "vaga" : "vagas"}`;

  return (
    <>
      {/* Flash luminoso */}
      <div
        key={`flash-${local.id}`}
        className="sev-flash pointer-events-none fixed inset-0 z-[200] bg-white"
      />
      {/* Holofote (spotlight radial) atrás do modal */}
      <div
        key={`holo-${local.id}`}
        className="sev-holofote pointer-events-none fixed inset-0 z-[205]"
        style={{
          background:
            "radial-gradient(circle at 50% 38%, rgba(16,185,129,0.35), rgba(2,6,23,0.92) 60%)",
        }}
      />
      {/* Modal gigante anti-quebra */}
      <div className="fixed inset-0 z-[210] flex items-center justify-center p-4">
        <div className="sev-slide-in w-full max-w-5xl rounded-3xl border-4 border-emerald-400 bg-gradient-to-b from-slate-900 to-slate-800 p-6 text-center text-white shadow-2xl sm:p-12">
          <p className="flex items-center justify-center gap-2 text-base font-black uppercase tracking-[0.3em] text-emerald-400 sm:text-lg">
            <span className="sev-live inline-block h-2.5 w-2.5 rounded-full bg-rose-500" />
            Plantão de Apuração · Resultado Consolidado
          </p>
          <h2 className="mt-2 text-4xl font-extrabold leading-tight sm:text-6xl">
            {local.nome}
          </h2>
          <p className="mt-2 text-lg text-slate-300 sm:text-2xl">
            Zona {local.zona} · {vagasLabel} · {local.totalVotos} votos
          </p>

          {local.eleitosCount === 0 ? (
            <p className="mt-10 text-3xl font-extrabold">
              Sem votos registrados.
            </p>
          ) : poucos ? (
            <div className="mt-8">
              <p className="text-2xl font-extrabold text-emerald-300">
                {local.eleitosCount === 1 ? "Eleito" : "Eleitos"}
              </p>
              <ul className="mx-auto mt-4 max-w-3xl space-y-3">
                {eleitos.map((c, i) => (
                  <li
                    key={c.nome}
                    className="flex items-center justify-between gap-4 rounded-2xl bg-white/10 px-6 py-4 text-2xl font-extrabold sm:text-3xl"
                  >
                    <span className="flex items-center gap-3 text-left">
                      <span>{MEDALHAS[i] ?? "•"}</span>
                      {c.nome}
                    </span>
                    <span className="shrink-0 text-emerald-300">{c.votos}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="mt-8">
              <p className="text-2xl font-extrabold text-emerald-300">
                Pódio dos 3 primeiros
              </p>
              <div className="mt-6 flex items-end justify-center gap-3 sm:gap-5">
                <PodioColuna pos={2} nome={podio[1]?.nome} votos={podio[1]?.votos} altura="h-24 sm:h-28" />
                <PodioColuna pos={1} nome={podio[0]?.nome} votos={podio[0]?.votos} altura="h-36 sm:h-44" />
                <PodioColuna pos={3} nome={podio[2]?.nome} votos={podio[2]?.votos} altura="h-16 sm:h-20" />
              </div>
              {restantes > 0 && (
                <p className="mt-8 text-2xl font-extrabold sm:text-3xl">
                  …e mais {restantes} representantes eleitos
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
