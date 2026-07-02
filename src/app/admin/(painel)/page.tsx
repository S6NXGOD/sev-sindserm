import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowDownWideNarrow,
  ArrowUpWideNarrow,
  Building2,
  CheckCircle2,
  Clock,
  Crown,
  Gauge,
  ListChecks,
  MapPin,
  TrendingUp,
  Users,
  Vote,
} from "lucide-react";
import {
  getDashboardData,
  getLiderancaParcial,
  getMuralEleitos,
  getPresentationData,
} from "@/lib/dashboard";
import {
  getCurrentElectionYear,
  getSelectedElectionYear,
  requirePleito,
} from "@/lib/election";
import { formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AutoRefresh } from "@/components/admin/auto-refresh";
import { LowTurnoutLocations } from "@/components/admin/low-turnout-locations";
import { RitmoCard } from "@/components/admin/ritmo-card";
import { StatusPieChart } from "@/components/admin/status-pie-chart";
import { PresentationMode } from "@/components/admin/presentation/presentation-mode";
import { NovoResultadoSom } from "@/components/transparencia/novo-resultado-som";

export const dynamic = "force-dynamic";

function Kpi({
  label,
  value,
  icon: Icon,
  tone = "default",
  hint,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "green" | "amber" | "red" | "blue";
  hint?: string;
}) {
  const toneClass = {
    default: "bg-slate-100 text-primary",
    green: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    red: "bg-rose-50 text-rose-600",
    blue: "bg-sky-50 text-sky-600",
  }[tone];
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`rounded-lg p-2.5 ${toneClass}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-bold leading-none">
            {value.toLocaleString("pt-BR")}
          </p>
          <p className="text-xs text-muted-foreground">{label}</p>
          {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { ano?: string };
}) {
  await requirePleito();
  const ano = getSelectedElectionYear(searchParams.ano);
  const anoVigente = getCurrentElectionYear();
  const [d, lideranca, presentationLocais, mural] = await Promise.all([
    getDashboardData(ano),
    getLiderancaParcial(ano),
    getPresentationData(ano),
    getMuralEleitos(ano),
  ]);

  const trienio = `${ano}-${ano + 3}`;
  const totalAlertas =
    d.alertas.semCandidatos.length +
    d.alertas.lotados.length +
    d.alertas.encerrandoEm24h.length;
  const maxZona = Math.max(1, ...d.zonasAtivas.map((z) => z.votos));

  return (
    <div className="space-y-6">
      {/* Som de "resultado consolidado" (success.mp3) ao encerrar um local. */}
      <NovoResultadoSom encerradas={d.kpis.encerradas} />

      {/* Cabeçalho do pleito vigente */}
      <Card className="border-primary/20 bg-gradient-to-r from-slate-50 to-white">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
                Eleições Representantes de Base
              </h1>
              <Badge variant="success" className="gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                </span>
                Tempo Real
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Triênio {trienio}
              {ano !== anoVigente
                ? " · visualização histórica (auditoria)"
                : " · pleito vigente"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <PresentationMode
              data={d}
              locais={presentationLocais}
              mural={mural}
              trienio={trienio}
            />
            <AutoRefresh
              geradoEm={d.geradoEm}
              nextCloseAt={d.proximoEncerramento}
            />
          </div>
        </CardContent>
      </Card>

      {/* KPIs principais */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi
          label="Total de votos"
          value={d.kpis.votos}
          icon={Vote}
          tone="blue"
        />
        <Kpi
          label="Locais ativos (votando agora)"
          value={d.kpis.abertas}
          icon={Activity}
          tone="green"
        />
        <Kpi
          label="Votos na última hora"
          value={d.kpis.votosUltimaHora}
          icon={TrendingUp}
          tone="amber"
          hint="comparecimento nos últimos 60 min"
        />
      </div>

      {/* KPIs secundários */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Kpi label="Locais" value={d.kpis.locais} icon={Building2} />
        <Kpi label="Candidatos" value={d.kpis.candidatos} icon={Users} />
        <Kpi
          label="Não iniciadas"
          value={d.kpis.naoIniciadas}
          icon={Clock}
          tone="amber"
        />
        <Kpi
          label="Encerradas"
          value={d.kpis.encerradas}
          icon={CheckCircle2}
          tone="red"
        />
      </div>

      {/* Representação da Base: Candidatos vs Vagas vs Vagas preenchidas. */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-5 w-5" />
            Representação da Base
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Adesão e “buracos” na representação — vagas preenchidas por candidatos
            que já receberam votos.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border bg-slate-50 p-3">
              <p className="text-2xl font-bold leading-none">
                {d.kpis.candidatos.toLocaleString("pt-BR")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Candidatos</p>
            </div>
            <div className="rounded-lg border bg-slate-50 p-3">
              <p className="text-2xl font-bold leading-none">
                {d.kpis.vagas.toLocaleString("pt-BR")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Vagas do pleito</p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-2xl font-bold leading-none text-emerald-700">
                {d.kpis.vagasPreenchidas.toLocaleString("pt-BR")}
              </p>
              <p className="mt-1 text-xs text-emerald-700/80">Vagas preenchidas</p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-2xl font-bold leading-none text-amber-700">
                {Math.max(
                  0,
                  d.kpis.vagas - d.kpis.vagasPreenchidas,
                ).toLocaleString("pt-BR")}
              </p>
              <p className="mt-1 text-xs text-amber-700/80">Vagas em aberto</p>
            </div>
          </div>
          <div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{
                  width: `${
                    d.kpis.vagas > 0
                      ? Math.round(
                          (d.kpis.vagasPreenchidas / d.kpis.vagas) * 100,
                        )
                      : 0
                  }%`,
                }}
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {d.kpis.vagas > 0
                ? Math.round((d.kpis.vagasPreenchidas / d.kpis.vagas) * 100)
                : 0}
              % das vagas preenchidas ({d.kpis.vagasPreenchidas.toLocaleString(
                "pt-BR",
              )}{" "}
              de {d.kpis.vagas.toLocaleString("pt-BR")})
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Gráficos */}
      <div className="grid gap-6 lg:grid-cols-3">
        <RitmoCard ano={ano} inicial={d.ritmoHoje} />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-5 w-5" />
              Status dos links
            </CardTitle>
            <CardDescription>Distribuição por situação.</CardDescription>
          </CardHeader>
          <CardContent>
            <StatusPieChart data={d.statusPie} />
          </CardContent>
        </Card>
      </div>

      {/* Liderança parcial por local (zonas ativas) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Crown className="h-5 w-5" />
            Liderança Parcial por Local (Zonas Ativas)
          </CardTitle>
          <CardDescription>
            Candidatos que se elegeriam neste momento nos locais com votação em
            andamento. Atualiza conforme os votos entram.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {lideranca.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhuma votação em andamento agora.
            </p>
          ) : (
            <>
            {d.kpis.abertas > lideranca.length && (
              <p className="mb-3 rounded-md bg-slate-50 px-3 py-2 text-xs text-muted-foreground">
                Exibindo {lideranca.length} de {d.kpis.abertas} locais em
                andamento.{" "}
                <Link
                  href="/admin/locais?status=open"
                  className="font-medium text-primary hover:underline"
                >
                  Ver todos em Locais
                </Link>
                .
              </p>
            )}
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {lideranca.map((l) => (
                <div key={l.id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/admin/locais/${l.id}`}
                      className="font-medium leading-tight hover:underline"
                    >
                      {l.nome}
                    </Link>
                    <Badge variant="outline" className="shrink-0">
                      {l.zona}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Vagas: <strong>{l.vagas}</strong> · {l.totalCandidatos}{" "}
                    candidato(s) · {l.totalVotos} voto(s)
                  </p>
                  {l.liderando.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Aguardando votos…
                    </p>
                  ) : (
                    <ol className="mt-2 space-y-0.5 text-sm">
                      {l.liderando.map((c, i) => (
                        <li key={c.nome} className="flex justify-between gap-2">
                          <span className="truncate">
                            <span className="text-muted-foreground">
                              {i + 1}º
                            </span>{" "}
                            {c.nome}
                          </span>
                          <span className="shrink-0 font-medium text-emerald-700">
                            {c.votos}
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              ))}
            </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Zonas + Ranking de adesão */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-5 w-5" />
              Divisão por Zonas
            </CardTitle>
            <CardDescription>Votos por zona — da maior adesão.</CardDescription>
          </CardHeader>
          <CardContent>
            {d.zonasAtivas.every((z) => z.votos === 0) ? (
              <p className="text-sm text-muted-foreground">Sem votos ainda.</p>
            ) : (
              <ul className="space-y-3">
                {d.zonasAtivas.map((z) => (
                  <li key={z.rotulo} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{z.rotulo}</span>
                      <span className="text-muted-foreground">
                        {z.votos} voto(s)
                      </span>
                    </div>
                    <Progress value={(z.votos / maxZona) * 100} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Gauge className="h-5 w-5" />
              Ranking de Adesão
            </CardTitle>
            <CardDescription>
              Locais com maior e menor volume de votos.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                <ArrowUpWideNarrow className="h-4 w-4" />
                Maior adesão
              </p>
              <ol className="space-y-1.5">
                {d.top3.map((l, i) => (
                  <li
                    key={l.id}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <Link
                      href={`/admin/locais/${l.id}`}
                      className="truncate hover:underline"
                    >
                      {i + 1}. {l.nome}
                    </Link>
                    <Badge variant="secondary">{l.votos}</Badge>
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-rose-700">
                <ArrowDownWideNarrow className="h-4 w-4" />
                Menor adesão
              </p>
              {d.bottom3.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Poucos locais para comparar.
                </p>
              ) : (
              <ol className="space-y-1.5">
                {d.bottom3.map((l, i) => (
                  <li
                    key={l.id}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <Link
                      href={`/admin/locais/${l.id}`}
                      className="truncate hover:underline"
                    >
                      {i + 1}. {l.nome}
                    </Link>
                    <Badge variant="outline">{l.votos}</Badge>
                  </li>
                ))}
              </ol>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Painel estratégico: locais com menor adesão (Mobile-First) */}
      <LowTurnoutLocations ano={ano} geradoEm={d.geradoEm} limit={5} />

      {/* Alertas */}
      {totalAlertas > 0 && (
        <Card className="border-amber-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-amber-700">
              <AlertTriangle className="h-5 w-5" />
              Alertas ({totalAlertas})
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="mb-1 text-sm font-medium">Sem candidatos</p>
              {d.alertas.semCandidatos.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {d.alertas.semCandidatos.map((w) => (
                    <li key={w.id}>
                      <Link
                        href={`/admin/locais/${w.id}`}
                        className="hover:underline"
                      >
                        {w.nome}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="mb-1 text-sm font-medium">Limite atingido</p>
              {d.alertas.lotados.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {d.alertas.lotados.map((w) => (
                    <li key={w.id} className="flex items-center gap-2">
                      <Link
                        href={`/admin/locais/${w.id}`}
                        className="hover:underline"
                      >
                        {w.nome}
                      </Link>
                      <Badge variant="destructive">{w.voteLimit}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="mb-1 text-sm font-medium">Encerrando em 24h</p>
              {d.alertas.encerrandoEm24h.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {d.alertas.encerrandoEm24h.map((w) => (
                    <li key={w.id}>
                      <Link
                        href={`/admin/locais/${w.id}`}
                        className="hover:underline"
                      >
                        {w.nome}
                      </Link>
                      <span className="ml-1 text-xs text-muted-foreground">
                        {formatDateTime(w.fim)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de apuração (busca + paginação + regra de vagas) */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <p className="flex items-center gap-2 font-medium">
              <ListChecks className="h-5 w-5" />
              Lista de Apuração por Local
            </p>
            <p className="text-sm text-muted-foreground">
              Busca, paginação e apuração com regra de vagas (Eleito/Suplente) —
              suporta locais com milhares de candidatos.
            </p>
          </div>
          <Button asChild>
            <Link href="/admin/locais">Abrir lista de apuração</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
