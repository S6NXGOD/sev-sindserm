import { Repeat } from "lucide-react";

/** Rodada 2+ = eleição suplementar (nova rodada por vagas que faltaram). */
export function isSuplementar(rodada: number | null | undefined): boolean {
  return (rodada ?? 1) >= 2;
}

/** Ordinal feminino pt-BR ("2ª", "3ª"…) para "Nª rodada". */
export function ordinalRodada(n: number): string {
  return `${n}ª`;
}

/**
 * Selo de ELEIÇÃO SUPLEMENTAR — violeta (mesma cor da suplementar na
 * transparência), distinto dos selos de status (cinza/verde/vermelho) para
 * saltar aos olhos numa lista. Não renderiza nada na 1ª rodada (comum). Puro
 * (sem estado) — serve tanto em Server quanto em Client Components.
 */
export function SuplementarBadge({
  rodada,
  className = "",
}: {
  rodada: number;
  className?: string;
}) {
  if (!isSuplementar(rodada)) return null;
  return (
    <span
      title={`Eleição suplementar — ${ordinalRodada(rodada)} rodada`}
      className={`inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-700 ${className}`}
    >
      <Repeat className="h-3 w-3 shrink-0" />
      Suplementar · {ordinalRodada(rodada)} rodada
    </span>
  );
}
