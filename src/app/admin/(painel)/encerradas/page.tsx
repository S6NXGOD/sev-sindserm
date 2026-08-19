import Link from "next/link";
import {
  AlertTriangle,
  Award,
  Building2,
  CheckCircle2,
  ExternalLink,
  Scale,
  Vote,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getReportData } from "@/lib/reports";
import {
  getCurrentElectionYear,
  getElectionLogos,
  getSelectedElectionYear,
  requirePleito,
  tituloInstitucional,
} from "@/lib/election";
import { requireModule } from "@/lib/current-user";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ApuracoesList } from "@/components/admin/apuracoes-list";
import { ApuracaoPdfButton } from "@/components/admin/apuracao-pdf-button";
import { EmpatesPanel } from "@/components/admin/empates-panel";
import { VagasVaziasPanel } from "@/components/admin/vagas-vazias-panel";
import { ExportEleitosButton } from "@/components/admin/export-eleitos-button";

export const dynamic = "force-dynamic";

/** KPI compacto (mesma pegada dos cards da dashboard). */
function Kpi({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "green" | "blue" | "amber";
}) {
  const cls = {
    default: "bg-slate-100 text-slate-700",
    green: "bg-emerald-50 text-emerald-600",
    blue: "bg-sky-50 text-sky-600",
    amber: "bg-amber-50 text-amber-600",
  }[tone];
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`rounded-lg p-2.5 ${cls}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold leading-none">
            {value.toLocaleString("pt-BR")}
          </p>
          <p className="mt-1 text-xs leading-tight text-muted-foreground">
            {label}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * ÁREA RÁPIDA — Encerradas & Eleitos. Um só lugar para NAVEGAR as votações
 * concluídas, ver os eleitos, os EMPATES a resolver e baixar o documento.
 * Reaproveita getReportData({ somenteEncerradas }) e a ApuracoesList.
 */
export default async function EncerradasPage({
  searchParams,
}: {
  searchParams: { ano?: string };
}) {
  await requireModule("encerradas", "VIEW");
  await requirePleito();
  const ano = getSelectedElectionYear(searchParams.ano);
  const anoVigente = getCurrentElectionYear();

  const [data, logos, pleito] = await Promise.all([
    getReportData({ anoEleicao: ano, somenteEncerradas: true }),
    getElectionLogos(ano),
    prisma.election.findFirst({
      where: { ano },
      orderBy: [{ isEleicaoEspecial: "asc" }, { createdAt: "asc" }],
      select: { titulo: true, duracaoMandato: true },
    }),
  ]);

  const totalEleitos = data.apuracoes.reduce((s, a) => s + a.eleitos.length, 0);
  const totalVotos = data.apuracoes.reduce((s, a) => s + a.totalVotos, 0);
  const empates = data.apuracoes.filter((a) => a.temEmpate);
  // Vagas sem eleito: separa o que ainda precisa de DECISÃO do que já foi
  // finalizado (aceito) — vaga vazia costuma ser natural, não obriga suplementar.
  const toVagaItem = (a: (typeof data.apuracoes)[number]) => ({
    id: a.id,
    nome: a.nome,
    orgao: a.orgao,
    zona: a.zona,
    vagas: a.vagas,
    vagasVazias: a.vagasVazias,
    // Encerrou com NENHUM eleito (caso mais grave — destaque/alerta).
    semEleito: a.eleitos.length === 0,
    totalVotos: a.totalVotos,
  });
  const vagaVaziaPendentes = data.apuracoes
    .filter((a) => a.vagasVazias > 0 && !a.vagasVaziasAceitas)
    .map(toVagaItem);
  const vagaVaziaAceitas = data.apuracoes
    .filter((a) => a.vagasVazias > 0 && a.vagasVaziasAceitas)
    .map(toVagaItem);
  // Encerrados SEM NENHUM eleito ainda pendentes de decisão (para o botão fácil).
  const semEleitoCount = vagaVaziaPendentes.filter((i) => i.semEleito).length;

  // Opções de filtro derivadas do que REALMENTE existe entre as encerradas.
  const orgaos = [...new Set(data.apuracoes.map((a) => a.orgao))].sort((x, y) =>
    x.localeCompare(y),
  );
  const zonas = [...new Set(data.apuracoes.map((a) => a.zona))].sort((x, y) =>
    x.localeCompare(y),
  );

  const pdfHeader = {
    logoSindserm: logos.sindserm,
    logoPleito: logos.pleito,
    tituloPleito: tituloInstitucional(pleito?.titulo, ano, pleito?.duracaoMandato ?? 3),
    subtitulo: "Relatório de Votações Encerradas",
    filtro: "Apenas votações encerradas",
    geradoEm: data.geradoEmDisplay,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Encerradas &amp; Eleitos
        </h1>
        <p className="text-sm text-muted-foreground">
          Votações concluídas da eleição {ano}
          {ano !== anoVigente ? " (histórico — auditoria)" : ""} — eleitos,
          empates a resolver e o documento oficial.
        </p>
      </div>

      {/* KPIs. "Empates" salta em âmbar quando há resultado travado. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <Kpi
          label="Locais encerrados"
          value={data.apuracoes.length}
          icon={CheckCircle2}
          tone="green"
        />
        <Kpi label="Eleitos" value={totalEleitos} icon={Award} tone="blue" />
        <Kpi label="Votos apurados" value={totalVotos} icon={Vote} />
        <Kpi
          label="Empates a resolver"
          value={empates.length}
          icon={Scale}
          tone="amber"
        />
      </div>

      {/* BOTÃO FÁCIL: encerrados sem NENHUM eleito (só aparece se houver).
          Leva direto ao painel de decisão, com esses casos destacados no topo. */}
      {semEleitoCount > 0 && (
        <a
          href="#vagas-sem-eleito"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-rose-300 bg-rose-50 p-4 shadow-sm transition hover:bg-rose-100"
        >
          <div className="flex min-w-0 items-center gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-rose-600" />
            <div className="min-w-0">
              <p className="font-bold text-rose-900">
                {semEleitoCount}{" "}
                {semEleitoCount === 1
                  ? "local encerrado sem nenhum eleito"
                  : "locais encerrados sem nenhum eleito"}
              </p>
              <p className="text-xs text-rose-700">
                Abriram e fecharam sem eleger ninguém. Toque para revisar e agir.
              </p>
            </div>
          </div>
          <span className="shrink-0 text-sm font-semibold text-rose-700">
            Ver e agir →
          </span>
        </a>
      )}

      {/* EMPATES — no topo, para resolver rápido (só aparece se houver). */}
      <EmpatesPanel empates={empates} />

      {/* VAGAS SEM ELEITO → decisão caso a caso (suplementar OU manter assim). */}
      <VagasVaziasPanel
        pendentes={vagaVaziaPendentes}
        aceitas={vagaVaziaAceitas}
      />

      {/* Ações rápidas — o PDF agora é gerado direto aqui (jsPDF). */}
      <Card>
        <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:flex-wrap sm:items-center">
          {data.apuracoes.length > 0 && (
            <ApuracaoPdfButton data={data} header={pdfHeader} />
          )}
          <ExportEleitosButton ano={ano} />
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/admin/locais?status=closed">
              <Building2 className="mr-2 h-4 w-4" />
              Locais encerrados
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/transparencia" target="_blank">
              <ExternalLink className="mr-2 h-4 w-4" />
              Portal público
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* Lista de apurações encerradas (busca + ordenação + cards). */}
      {data.apuracoes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <CheckCircle2 className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              Nenhuma votação encerrada ainda. Assim que um local for encerrado,
              os eleitos aparecem aqui.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-1">
              <Link href="/admin/locais">Ver locais de trabalho</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ApuracoesList
          apuracoes={data.apuracoes}
          orgaos={orgaos}
          zonas={zonas}
          defaultSort="fim_desc"
          showControls
        />
      )}
    </div>
  );
}
