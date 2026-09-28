import { CalendarRange } from "lucide-react";

function fmtDia(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "America/Sao_Paulo",
    }).format(new Date(iso));
  } catch {
    return "—";
  }
}

const DIA = 86_400_000;

/**
 * Faixa do PERÍODO OFICIAL do pleito (dataInicioGeral → dataFimGeral) — a janela
 * geral que trava a votação. Distinta da janela de CADA local (que é menor e fica
 * dentro deste período). Mostra um selo de estado (abre em / em votação / encerrado)
 * com contagem de dias. Componente puro — serve em Server e Client Components.
 */
export function PeriodoPleito({
  inicio,
  fim,
  hint = false,
  className = "",
}: {
  inicio: string | null;
  fim: string | null;
  /** Mostra a nota "cada local vota em sua própria janela" (portal público). */
  hint?: boolean;
  className?: string;
}) {
  if (!inicio && !fim) return null;

  const agora = Date.now();
  const ini = inicio ? new Date(inicio).getTime() : null;
  const f = fim ? new Date(fim).getTime() : null;

  let selo: { texto: string; cls: string };
  if (ini && agora < ini) {
    const d = Math.max(1, Math.ceil((ini - agora) / DIA));
    selo = {
      texto: `Abre em ${d} dia${d === 1 ? "" : "s"}`,
      cls: "bg-violet-100 text-violet-700",
    };
  } else if (f && agora > f) {
    selo = { texto: "Período encerrado", cls: "bg-slate-200 text-slate-600" };
  } else if (f) {
    const d = Math.ceil((f - agora) / DIA);
    selo = {
      texto: d <= 0 ? "Último dia" : `Encerra em ${d} dia${d === 1 ? "" : "s"}`,
      cls: "bg-emerald-100 text-emerald-700",
    };
  } else {
    selo = { texto: "Em período de votação", cls: "bg-emerald-100 text-emerald-700" };
  }

  return (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border bg-card px-4 py-3 shadow-sm ${className}`}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
        <CalendarRange className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted-foreground">
          Período oficial do pleito
        </p>
        <p className="text-sm font-bold leading-tight sm:text-base">
          {inicio ? fmtDia(inicio) : "—"}{" "}
          <span className="font-normal text-muted-foreground">até</span>{" "}
          {fim ? fmtDia(fim) : "—"}
        </p>
        {hint && (
          <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
            Cada local vota em sua própria janela, dentro deste período.
          </p>
        )}
      </div>
      <span
        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${selo.cls}`}
      >
        {selo.texto}
      </span>
    </div>
  );
}
