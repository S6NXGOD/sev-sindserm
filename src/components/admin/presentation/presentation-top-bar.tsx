"use client";

import { Radio, X } from "lucide-react";
import type { DashboardData, MuralData } from "@/lib/dashboard";

function MiniKpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <p className="text-3xl font-black tabular-nums leading-none xl:text-4xl">
        {value.toLocaleString("pt-BR")}
      </p>
      <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </p>
    </div>
  );
}

/**
 * Barra superior fixa do telão: identidade do pleito, KPIs macro e o WIDGET de
 * VAGAS PREENCHIDAS com barra de progresso neon (contador macro).
 */
export function PresentationTopBar({
  data,
  mural,
  trienio,
  onExit,
}: {
  data: DashboardData;
  mural: MuralData;
  trienio: string;
  onExit: () => void;
}) {
  const total = mural.vagasTotais;
  const filled = Math.min(mural.totalEleitos, total || mural.totalEleitos);
  const pct = total > 0 ? Math.min(100, (filled / total) * 100) : 0;

  return (
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-white/10 bg-slate-950/60 px-8 py-4">
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold leading-tight xl:text-3xl">
            Eleições Representantes de Base
          </h1>
          <p className="text-sm font-semibold text-slate-400">
            Triênio {trienio}
          </p>
        </div>
        <span className="flex items-center gap-2 rounded-full bg-rose-500/20 px-3 py-1 text-sm font-extrabold text-rose-300">
          <Radio className="sev-live h-4 w-4" />
          AO VIVO
        </span>
      </div>

      <div className="flex flex-1 items-center justify-end gap-6">
        <div className="hidden items-center gap-6 md:flex">
          <MiniKpi label="Votos" value={data.kpis.votos} />
          <MiniKpi label="Locais ativos" value={data.kpis.abertas} />
          <MiniKpi label="Encerradas" value={data.kpis.encerradas} />
        </div>

        {/* Widget macro de vagas preenchidas (barra neon) */}
        <div className="min-w-[240px] max-w-sm flex-1 rounded-2xl bg-white/5 px-4 py-2 ring-1 ring-white/10">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Vagas preenchidas
            </span>
            <span className="text-lg font-black tabular-nums text-emerald-300">
              {filled.toLocaleString("pt-BR")}
              <span className="text-sm font-bold text-slate-400">
                {" "}
                / {total.toLocaleString("pt-BR")}
              </span>
            </span>
          </div>
          <div className="mt-1.5 h-3 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="sev-neon h-full rounded-full bg-emerald-400 transition-[width] duration-700 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={onExit}
          className="flex items-center gap-1 rounded-md bg-white/10 px-3 py-1.5 text-sm font-medium hover:bg-white/20"
        >
          <X className="h-4 w-4" />
          Sair
        </button>
      </div>
    </header>
  );
}
