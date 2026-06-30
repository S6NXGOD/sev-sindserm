"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { TrendingDown } from "lucide-react";
import { fetchLowTurnoutLocations } from "@/lib/actions/dashboard-actions";
import type { LowTurnoutLocal } from "@/lib/dashboard";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/** Frase de votos pedida no briefing (ex.: "Apenas 3 votos registrados"). */
function votosLabel(n: number): string {
  if (n <= 0) return "Nenhum voto registrado";
  if (n === 1) return "Apenas 1 voto registrado";
  return `Apenas ${n.toLocaleString("pt-BR")} votos registrados`;
}

/**
 * Skeleton com a MESMA estrutura/altura das linhas reais — evita "pulo" de
 * layout (CLS) quando os dados chegam da Server Action.
 */
function LowTurnoutSkeleton({ rows }: { rows: number }) {
  return (
    <ul className="space-y-2.5" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <li
          key={i}
          className="rounded-lg border border-amber-100 bg-amber-50/40 p-3"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <div className="h-6 w-6 shrink-0 animate-pulse rounded-md bg-amber-200/70" />
              <div className="min-w-0 space-y-1.5">
                <div className="h-3.5 w-40 max-w-[60vw] animate-pulse rounded bg-amber-200/70" />
                <div className="h-2.5 w-24 animate-pulse rounded bg-amber-100" />
              </div>
            </div>
            <div className="h-6 w-8 shrink-0 animate-pulse rounded bg-amber-200/70" />
          </div>
          <div className="mt-2 h-2 w-full animate-pulse rounded-full bg-amber-100" />
          <div className="mt-1.5 h-2.5 w-32 animate-pulse rounded bg-amber-100" />
        </li>
      ))}
    </ul>
  );
}

/**
 * Painel "Locais com Menor Adesão" — Mobile-First.
 *
 * Busca pela Server Action no cliente (Skeleton enquanto carrega) e re-busca
 * SILENCIOSAMENTE a cada atualização do dashboard (mudança de `geradoEm`), sem
 * voltar ao skeleton — assim o tempo real não pisca nem causa layout shift.
 */
export function LowTurnoutLocations({
  ano,
  geradoEm,
  limit = 5,
}: {
  ano: number;
  /** Sinal de atualização do dashboard (muda a cada refresh em tempo real). */
  geradoEm: string;
  limit?: number;
}) {
  const [data, setData] = useState<LowTurnoutLocal[] | null>(null);
  const prevAno = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    // Só volta ao skeleton em troca de pleito (ou no 1º mount); refresh em tempo
    // real mantém os dados na tela e troca por baixo dos panos.
    const anoMudou = prevAno.current !== ano;
    prevAno.current = ano;
    if (anoMudou) setData(null);

    fetchLowTurnoutLocations(ano, limit).then((res) => {
      if (alive) setData(res);
    });
    return () => {
      alive = false;
    };
  }, [ano, geradoEm, limit]);

  // Escala dos rótulos da barra: comparação relativa ENTRE os piores locais.
  const maxVotos = data ? Math.max(1, ...data.map((l) => l.votos)) : 1;

  return (
    <Card className="border-amber-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-amber-700">
          <TrendingDown className="h-5 w-5" />
          Locais de Trabalho com Menor Adesão
        </CardTitle>
        <CardDescription>
          Os {limit} locais com menos votos entre os que já iniciaram a votação.
          Use para priorizar a mobilização.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data === null ? (
          <LowTurnoutSkeleton rows={limit} />
        ) : data.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhum local com votação iniciada ainda.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {data.map((l, i) => {
              const pct = Math.round((l.votos / maxVotos) * 100);
              return (
                <li
                  key={l.id}
                  className="rounded-lg border border-amber-100 bg-amber-50/40 p-3 transition-colors hover:bg-amber-50"
                >
                  <div className="flex items-center justify-between gap-3">
                    {/* min-w-0 é o que permite o truncate funcionar dentro do flex */}
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-amber-100 text-xs font-bold text-amber-700">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <Link
                          href={`/admin/locais/${l.id}`}
                          title={l.nome}
                          className="block truncate font-medium leading-tight hover:underline"
                        >
                          {l.nome}
                        </Link>
                        <p
                          title={`${l.orgao} · Zona ${l.zona}`}
                          className="truncate text-xs text-muted-foreground"
                        >
                          {l.orgao} · Zona {l.zona}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="text-lg font-bold leading-none text-amber-700 tabular-nums">
                        {l.votos.toLocaleString("pt-BR")}
                      </span>
                      {l.adesaoPct !== null && (
                        <Badge
                          variant="outline"
                          className="mt-1 block border-amber-200 text-[11px] font-normal text-amber-700"
                          title="Votos ÷ limite de votos do local"
                        >
                          {l.adesaoPct}% do limite
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Barra horizontal: nome em cima, barra embaixo — não esmaga
                      o rótulo no celular como faria um gráfico de barras vertical. */}
                  <div
                    className="mt-2 h-2 w-full overflow-hidden rounded-full bg-amber-100"
                    role="img"
                    aria-label={`${l.nome}: ${votosLabel(l.votos)}`}
                  >
                    <div
                      className="h-full rounded-full bg-amber-400"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-xs font-medium text-amber-700/90">
                    {votosLabel(l.votos)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
