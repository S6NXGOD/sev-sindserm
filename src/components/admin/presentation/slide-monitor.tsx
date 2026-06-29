"use client";

import { Activity } from "lucide-react";
import type { PresentationLocal } from "@/lib/dashboard";
import { FlipList } from "./flip-list";

const STATUS = {
  open: { label: "EM ANDAMENTO", cls: "bg-emerald-500/20 text-emerald-300" },
  closed: { label: "ENCERRADA", cls: "bg-rose-500/20 text-rose-300" },
  upcoming: { label: "AGUARDANDO", cls: "bg-amber-500/20 text-amber-300" },
} as const;

/**
 * SLIDE 1 — Painel de Monitoramento. Esquerda: apuração por local com auto-scroll
 * vertical contínuo. Direita: liderança parcial dos locais em andamento (com
 * animação de troca de posições - FlipList).
 */
export function SlideMonitor({ locais }: { locais: PresentationLocal[] }) {
  const abertos = locais.filter((l) => l.status === "open").slice(0, 8);
  const scroll = locais.length >= 8;
  const scrollDuration = Math.max(20, locais.length * 2.2);

  return (
    <div className="sev-slide-in grid h-full min-h-0 grid-cols-1 gap-5 lg:grid-cols-5">
      {/* Esquerda: apuração por local (auto-scroll) */}
      <section className="flex min-h-0 flex-col rounded-2xl bg-white/5 ring-1 ring-white/10 lg:col-span-2">
        <h2 className="flex shrink-0 items-center gap-2 px-5 pb-2 pt-4 text-xl font-extrabold uppercase tracking-wider text-slate-300">
          <Activity className="h-5 w-5" />
          Apuração por Local
        </h2>
        <div className="relative min-h-0 flex-1 overflow-hidden px-3 pb-3">
          <div
            className={scroll ? "sev-marquee" : ""}
            style={scroll ? { animationDuration: `${scrollDuration}s` } : undefined}
          >
            {(scroll ? [...locais, ...locais] : locais).map((l, i) => (
              <div
                key={`${l.id}-${i}`}
                className="mb-2 flex items-center justify-between gap-3 rounded-xl bg-white/5 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-xl font-extrabold">{l.nome}</p>
                  <p className="truncate text-sm text-slate-400">
                    Zona {l.zona}
                    {l.top[0] ? ` · 1º ${l.top[0].nome}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-3xl font-black tabular-nums">
                    {l.totalVotos}
                  </span>
                  <span
                    className={`rounded-md px-2 py-1 text-xs font-bold ${STATUS[l.status].cls}`}
                  >
                    {STATUS[l.status].label}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Direita: liderança parcial */}
      <section className="min-h-0 overflow-y-auto rounded-2xl bg-white/5 p-4 ring-1 ring-white/10 lg:col-span-3">
        <h2 className="mb-3 text-xl font-extrabold uppercase tracking-wider text-slate-300">
          Liderança Parcial
        </h2>
        {abertos.length === 0 ? (
          <p className="text-lg text-slate-400">
            Nenhuma votação em andamento agora.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {abertos.map((l) => (
              <div key={l.id} className="rounded-xl bg-white/5 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="truncate text-lg font-extrabold">{l.nome}</p>
                  <span className="shrink-0 text-sm text-slate-400">
                    {l.vagas} {l.vagas === 1 ? "vaga" : "vagas"}
                  </span>
                </div>
                {l.top.length === 0 ? (
                  <p className="text-base text-slate-400">Aguardando votos…</p>
                ) : (
                  <FlipList items={l.top} getKey={(c) => c.nome} itemClassName="mb-1.5">
                    {(c, i) => (
                      <div className="flex items-center justify-between gap-2 rounded-lg bg-white/5 px-3 py-2">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="text-sm font-bold text-slate-400">
                            {i + 1}º
                          </span>
                          <span className="truncate text-lg font-bold">
                            {c.nome}
                          </span>
                        </span>
                        <span className="shrink-0 text-xl font-black tabular-nums text-emerald-300">
                          {c.votos}
                        </span>
                      </div>
                    )}
                  </FlipList>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
