"use client";

import { Trophy } from "lucide-react";
import type { MuralEleito } from "@/lib/dashboard";

/**
 * Ticker de rodapé (estilo telejornal): rolagem horizontal contínua com os
 * últimos servidores eleitos e seus votos. O conteúdo é duplicado para o loop
 * ser perfeito; a animação é só um transform (GPU) — leve para horas no telão.
 */
export function PresentationTicker({ eleitos }: { eleitos: MuralEleito[] }) {
  const temEleitos = eleitos.length > 0;
  // Duração proporcional à quantidade (mais nomes → rola mais devagar/maior trilho).
  const duracao = Math.max(24, eleitos.length * 6);

  return (
    <footer className="flex shrink-0 items-center gap-3 border-t border-white/10 bg-emerald-950/60 py-2">
      <span className="ml-6 flex shrink-0 items-center gap-2 rounded-md bg-emerald-500 px-3 py-1 text-sm font-black uppercase tracking-wider text-emerald-950">
        <Trophy className="h-4 w-4" />
        Eleitos
      </span>

      {!temEleitos ? (
        <p className="px-2 text-sm font-semibold text-slate-400">
          Aguardando os primeiros resultados consolidados…
        </p>
      ) : (
        <div className="relative flex-1 overflow-hidden">
          <div
            className="sev-ticker flex w-max"
            style={{ animationDuration: `${duracao}s` }}
          >
            {[...eleitos, ...eleitos].map((e, i) => (
              <span
                key={i}
                className="flex shrink-0 items-center gap-2 whitespace-nowrap px-6 text-base font-bold"
              >
                <span className="text-emerald-300">●</span>
                <span className="font-extrabold">{e.nome}</span>
                <span className="text-emerald-300 tabular-nums">
                  {e.votos} {e.votos === 1 ? "voto" : "votos"}
                </span>
                <span className="text-slate-400">· {e.local}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </footer>
  );
}
