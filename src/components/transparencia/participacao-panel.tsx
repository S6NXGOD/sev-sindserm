import { Award, BarChart3, MapPin, TrendingUp } from "lucide-react";
import type { TransparenciaData } from "@/lib/transparencia";

const STATUS_CLS: Record<string, string> = {
  open: "bg-emerald-100 text-emerald-700",
  closed: "bg-slate-200 text-slate-700",
};
const STATUS_LABEL: Record<string, string> = {
  open: "Em andamento",
  closed: "Encerrada",
};

/**
 * Painel PÚBLICO de Ranking & Participação. Substitui o gráfico de pizza (que,
 * com centenas de locais "aguardando", virava quase só cinza e informava pouco).
 * Mostra os locais com maior comparecimento, a participação por zona e o avanço
 * das vagas preenchidas — dados que o filiado usa de verdade. Server component.
 */
export function ParticipacaoPanel({
  ranking,
  porZona,
  totalVotantes,
  eleitos,
  vagas,
}: {
  ranking: TransparenciaData["rankingParticipacao"];
  porZona: TransparenciaData["votantesPorZona"];
  totalVotantes: number;
  eleitos: number;
  vagas: number;
}) {
  const maxRank = Math.max(1, ...ranking.map((l) => l.votantes));
  const maxZona = Math.max(1, ...porZona.map((z) => z.votantes));
  const pctVagas = vagas > 0 ? Math.round((eleitos / vagas) * 100) : 0;
  const semParticipacao = totalVotantes === 0;

  return (
    <section className="rounded-xl border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b p-4">
        <h2 className="flex items-center gap-2 text-base font-bold">
          <TrendingUp className="h-5 w-5 shrink-0 text-emerald-600" />
          Ranking &amp; Participação
        </h2>
        <span className="text-xs text-muted-foreground">
          {totalVotantes.toLocaleString("pt-BR")} votante(s) no total
        </span>
      </div>

      {semParticipacao ? (
        <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
          <BarChart3 className="h-7 w-7 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            A participação aparece aqui assim que as votações começarem.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 p-4 lg:grid-cols-2">
          {/* Ranking de locais por comparecimento */}
          <div className="min-w-0">
            <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
              <Award className="h-4 w-4 text-emerald-600" />
              Locais com maior participação
            </p>
            <ol className="space-y-2.5">
              {ranking.map((l, i) => (
                <li key={l.id} className="min-w-0">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="w-5 shrink-0 text-xs font-bold text-muted-foreground">
                        {i + 1}º
                      </span>
                      <span className="truncate font-medium">{l.nome}</span>
                      <span
                        className={`hidden shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold sm:inline ${
                          STATUS_CLS[l.status] ?? "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {STATUS_LABEL[l.status] ?? l.status}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-bold tabular-nums">
                      {l.votantes}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${(l.votantes / maxRank) * 100}%` }}
                      />
                    </div>
                    <span className="shrink-0 truncate text-[11px] text-muted-foreground">
                      Zona {l.zona}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Participação por zona + avanço das vagas */}
          <div className="min-w-0 space-y-5">
            <div>
              <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
                <MapPin className="h-4 w-4 text-sky-600" />
                Participação por zona
              </p>
              <ul className="space-y-2.5">
                {porZona.map((z) => (
                  <li key={z.zona} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{z.zona}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {z.votantes} votante(s)
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-sky-500"
                        style={{ width: `${(z.votantes / maxZona) * 100}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-lg border bg-emerald-50/60 p-3">
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-semibold text-emerald-800">
                  Vagas preenchidas
                </p>
                <p className="text-sm font-bold text-emerald-700">
                  {pctVagas}%
                </p>
              </div>
              <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-emerald-100">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${pctVagas}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-emerald-700/80">
                {eleitos.toLocaleString("pt-BR")} de{" "}
                {vagas.toLocaleString("pt-BR")} vagas já definidas nos locais
                encerrados.
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
