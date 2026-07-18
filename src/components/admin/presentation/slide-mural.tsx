"use client";

import { Award, Trophy } from "lucide-react";
import type { MuralData } from "@/lib/dashboard";
import { AutoScrollColumn } from "@/components/admin/presentation/auto-scroll-column";

const CARDS_MAX = 12; // até aqui: cards grandes; acima: letreiro de créditos.

function TitularBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-3 py-1 text-xs font-black uppercase tracking-wider text-emerald-950">
      <Award className="h-3.5 w-3.5" />
      Titular Eleito
    </span>
  );
}

/**
 * Layout de CARDS GRANDES — até 12 eleitos (alta visibilidade). Se os cards não
 * couberem na tela do telão, a coluna ROLA sozinha (AutoScrollColumn) para
 * revelar todos — antes ficavam cortados e fixos.
 */
function CardsGrandes({ mural }: { mural: MuralData }) {
  return (
    <AutoScrollColumn className="h-full">
      <div className="grid content-start gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {mural.eleitos.map((e, i) => (
          <div
            key={`${e.nome}-${i}`}
            className="flex flex-col gap-3 rounded-2xl border-2 border-emerald-400/60 bg-gradient-to-b from-emerald-950/40 to-white/5 p-6 ring-1 ring-emerald-400/20"
          >
            <TitularBadge />
            <p className="text-3xl font-black leading-tight xl:text-4xl">
              {e.nome}
            </p>
            <div className="mt-auto">
              <p className="truncate text-base font-semibold text-slate-300">
                {e.local}
              </p>
              <p className="truncate text-sm text-slate-400">{e.orgao}</p>
              <p className="mt-1 text-2xl font-extrabold text-emerald-300 tabular-nums">
                {e.votos} {e.votos === 1 ? "voto" : "votos"}
              </p>
            </div>
          </div>
        ))}
      </div>
    </AutoScrollColumn>
  );
}

/** Layout MASSIVO — letreiro de créditos rolantes + colunas por órgão. */
function LetreiroCreditos({ mural }: { mural: MuralData }) {
  const duracao = Math.max(30, mural.eleitos.length * 1.5);
  const restantes = mural.totalEleitos - mural.eleitos.length;
  const maxOrgao = Math.max(1, ...mural.porOrgao.map((o) => o.eleitos));

  return (
    <div className="grid h-full min-h-0 gap-5 lg:grid-cols-3">
      {/* Créditos rolantes (estilo cinema) */}
      <div className="relative min-h-0 overflow-hidden rounded-2xl bg-white/5 ring-1 ring-white/10 lg:col-span-2">
        <div
          className="sev-credits px-6 py-4"
          style={{ animationDuration: `${duracao}s` }}
        >
          {[0, 1].map((copia) => (
            <div key={copia}>
              {mural.eleitos.map((e, i) => (
                <div
                  key={`${copia}-${i}`}
                  className="flex items-baseline justify-between gap-4 border-b border-white/5 py-2"
                >
                  <span className="min-w-0">
                    <span className="text-2xl font-extrabold">{e.nome}</span>{" "}
                    <span className="text-sm text-slate-400">· {e.local}</span>
                  </span>
                  <span className="shrink-0 text-xl font-black tabular-nums text-emerald-300">
                    {e.votos}
                  </span>
                </div>
              ))}
              {restantes > 0 && (
                <p className="py-3 text-center text-lg font-bold text-emerald-300">
                  …e mais {restantes.toLocaleString("pt-BR")} eleitos
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Colunas dinâmicas por órgão */}
      <div className="min-h-0 overflow-y-auto rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
        <h3 className="mb-3 text-lg font-extrabold uppercase tracking-wider text-slate-300">
          Eleitos por órgão
        </h3>
        <ul className="space-y-2.5">
          {mural.porOrgao.map((o) => (
            <li key={o.orgao} className="space-y-1">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate font-bold">{o.orgao}</span>
                <span className="shrink-0 font-black tabular-nums text-emerald-300">
                  {o.eleitos}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-emerald-400"
                  style={{ width: `${(o.eleitos / maxOrgao) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * SLIDE 2 — Mural dos Eleitos. Proteção anti-quebra para grandes volumes:
 * até 12 eleitos → cards grandes; acima disso → letreiro de créditos rolantes
 * + colunas por órgão (DOM controlado, sem travar o navegador no telão).
 */
export function SlideMural({ mural }: { mural: MuralData }) {
  return (
    <div className="sev-slide-in flex h-full min-h-0 flex-col gap-4">
      <div className="flex shrink-0 flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-3 text-3xl font-black uppercase tracking-wide text-emerald-300 xl:text-4xl">
          <Trophy className="h-8 w-8" />
          Mural dos Eleitos
        </h2>
        <p className="text-lg font-bold text-slate-300">
          {mural.totalEleitos.toLocaleString("pt-BR")} eleitos ·{" "}
          {mural.vagasTotais.toLocaleString("pt-BR")} vagas
        </p>
      </div>

      <div className="min-h-0 flex-1">
        {mural.totalEleitos === 0 ? (
          <div className="flex h-full items-center justify-center rounded-2xl bg-white/5 text-2xl font-bold text-slate-400 ring-1 ring-white/10">
            Aguardando os primeiros locais encerrarem…
          </div>
        ) : mural.totalEleitos <= CARDS_MAX ? (
          <CardsGrandes mural={mural} />
        ) : (
          <LetreiroCreditos mural={mural} />
        )}
      </div>
    </div>
  );
}
