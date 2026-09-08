"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Crown, Loader2, Radio, Users } from "lucide-react";
import { fetchResultadoLocal } from "@/lib/actions/transparencia";
import type { LiderancaAoVivo, ResultadoLocal } from "@/lib/transparencia";

const FULL_PAGE = 20; // "ver mais" na lista completa (locais com muitas vagas).

/** Uma linha do ranking parcial: posição + nome + votos + barra de proporção. */
function LinhaLider({
  pos,
  nome,
  votos,
  max,
}: {
  pos: number;
  nome: string;
  votos: number;
  max: number;
}) {
  const pct = max > 0 ? Math.max(6, Math.round((votos / max) * 100)) : 0;
  return (
    <li className="rounded-lg border border-emerald-100 bg-white px-2.5 py-1.5">
      <div className="flex items-center gap-2">
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
            pos === 1
              ? "bg-amber-100 text-amber-700"
              : "bg-emerald-100 text-emerald-700"
          }`}
        >
          {pos === 1 ? <Crown className="h-3 w-3" /> : pos}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{nome}</span>
        <span className="shrink-0 text-xs font-bold tabular-nums text-emerald-800">
          {votos} {votos === 1 ? "voto" : "votos"}
        </span>
      </div>
      {/* Barra de proporção (relativa ao líder) — leitura visual rápida. */}
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-emerald-50">
        <div
          className="h-full rounded-full bg-emerald-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </li>
  );
}

/** Card de UM local com votação em andamento. */
function LocalAoVivo({
  item,
  parciaisPublicas,
}: {
  item: LiderancaAoVivo;
  parciaisPublicas: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [full, setFull] = useState<ResultadoLocal | null>(null);
  const [loading, setLoading] = useState(false);
  const [mostrarTodos, setMostrarTodos] = useState(FULL_PAGE);

  // Prévia: os provisoriamente eleitos = top `vagas` (limitado ao que veio).
  const previa = item.lideres.slice(0, item.vagas);
  const maxPrevia = previa[0]?.votos ?? 0;
  const emDisputa = Math.max(0, item.vagas - previa.length);

  async function verTodos() {
    const abrir = !aberto;
    setAberto(abrir);
    if (abrir && !full) {
      setLoading(true);
      try {
        setFull(await fetchResultadoLocal(item.id));
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <li className="min-w-0 rounded-xl border border-emerald-200 bg-white p-3 shadow-sm">
      <p className="truncate text-sm font-bold">{item.nome}</p>
      <p className="truncate text-xs text-muted-foreground">
        {item.orgao} · Zona {item.zona}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
          <Users className="h-3.5 w-3.5" />
          {item.votantes} {item.votantes === 1 ? "voto" : "votos"}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
          Em andamento
        </span>
        <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
          {item.vagas} {item.vagas === 1 ? "vaga" : "vagas"}
        </span>
      </div>

      {!parciaisPublicas ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Quem está liderando aparece quando esta votação encerrar.
        </p>
      ) : previa.length === 0 ? (
        <p className="mt-2 text-xs text-amber-700">
          Votação em andamento — ainda sem votos computados.
        </p>
      ) : (
        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50/60 p-2">
          <p className="mb-1.5 flex items-center justify-between gap-2 text-[11px] font-bold uppercase tracking-wide text-amber-700">
            <span>
              Liderando ({item.vagas === 1 ? "1 vaga" : `${item.vagas} vagas`})
            </span>
            <span className="font-medium normal-case text-amber-600">
              parcial · pode mudar
            </span>
          </p>
          <ol className="space-y-1.5">
            {previa.map((c, i) => (
              <LinhaLider
                key={`${c.nome}-${i}`}
                pos={i + 1}
                nome={c.nome}
                votos={c.votos}
                max={maxPrevia}
              />
            ))}
          </ol>

          {emDisputa > 0 && (
            <p className="mt-1.5 text-[11px] font-medium text-amber-700">
              + {emDisputa} {emDisputa === 1 ? "vaga" : "vagas"} em disputa
            </p>
          )}

          {/* Ver TODOS os que estão liderando (locais com muitas vagas). */}
          {item.vagas > previa.length && (
            <button
              type="button"
              onClick={verTodos}
              className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-md border border-amber-300 bg-white px-2 py-1.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-100"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : aberto ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
              {aberto ? "Recolher" : "Ver todos os que estão liderando"}
            </button>
          )}

          {aberto && full && (
            <div className="mt-2">
              {full.eleitos.length === 0 ? (
                <p className="text-xs text-amber-700">Sem votos computados.</p>
              ) : (
                <>
                  <ol className="space-y-1.5">
                    {full.eleitos.slice(0, mostrarTodos).map((c, i) => (
                      <LinhaLider
                        key={`${c.nome}-${i}`}
                        pos={i + 1}
                        nome={c.nome}
                        votos={c.votos}
                        max={full.eleitos[0]?.votos ?? 0}
                      />
                    ))}
                  </ol>
                  {mostrarTodos < full.eleitos.length && (
                    <button
                      type="button"
                      onClick={() => setMostrarTodos((n) => n + FULL_PAGE)}
                      className="mt-1.5 w-full rounded-md px-2 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100"
                    >
                      Ver mais (+{full.eleitos.length - mostrarTodos})
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

/**
 * "Apuração ao vivo": votações EM ANDAMENTO agora. Sempre mostra o comparecimento
 * (participação em tempo real); quando a diretoria habilita as parciais públicas,
 * mostra também OS QUE ESTÃO LIDERANDO (todos os provisoriamente eleitos, até o
 * nº de vagas), com ranking e barra de proporção. A página atualiza sozinha.
 */
export function ApuracaoAoVivo({
  itens,
  parciaisPublicas,
}: {
  itens: LiderancaAoVivo[];
  parciaisPublicas: boolean;
}) {
  if (itens.length === 0) return null;

  return (
    <section className="rounded-2xl border-2 border-emerald-300 bg-gradient-to-b from-emerald-50/80 to-white p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-bold text-emerald-900">
          <Radio className="h-5 w-5 text-emerald-600" />
          Apuração ao vivo
          <span className="relative flex h-2.5 w-2.5" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-600" />
          </span>
        </h2>
        <span className="rounded-full border border-emerald-300 bg-white px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
          {itens.length} em andamento · atualiza sozinho
        </span>
      </div>

      {!parciaisPublicas && (
        <p className="mb-3 text-xs text-emerald-800">
          Mostrando a <strong>participação em tempo real</strong>. Quem está
          liderando aparece quando cada votação <strong>encerra</strong>.
        </p>
      )}

      <ul className="grid gap-3 lg:grid-cols-2">
        {itens.map((l) => (
          <LocalAoVivo key={l.id} item={l} parciaisPublicas={parciaisPublicas} />
        ))}
      </ul>
    </section>
  );
}
