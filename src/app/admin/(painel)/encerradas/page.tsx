import Link from "next/link";
import {
  AlertTriangle,
  Award,
  Building2,
  CheckCircle2,
  ExternalLink,
  FileText,
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
import { Separator } from "@/components/ui/separator";
import { ApuracoesList } from "@/components/admin/apuracoes-list";
import { ApuracaoPdfButton } from "@/components/admin/apuracao-pdf-button";
import { RelatorioPendenciasButton } from "@/components/admin/relatorio-pendencias-button";
import { EmpatesPanel } from "@/components/admin/empates-panel";
import { VagasVaziasPanel } from "@/components/admin/vagas-vazias-panel";
import { ExportEleitosButton } from "@/components/admin/export-eleitos-button";
import { ExportEleitosPdfButton } from "@/components/admin/export-eleitos-pdf-button";

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
  // Locais dispensados (sem representação por decisão) saem dos painéis de
  // pendência — a diretoria já decidiu não ter representante ali.
  const pendentesBase = data.apuracoes.filter((a) => !a.semRepresentacao);
  const empates = pendentesBase.filter((a) => a.temEmpate);
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
  const vagaVaziaPendentes = pendentesBase
    .filter((a) => a.vagasVazias > 0 && !a.vagasVaziasAceitas)
    .map(toVagaItem);
  const vagaVaziaAceitas = pendentesBase
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
          Resultados &amp; Relatórios
        </h1>
        <p className="text-sm text-muted-foreground">
          Eleição {ano}
          {ano !== anoVigente ? " (histórico — auditoria)" : ""} — eleitos,
          empates a resolver e os documentos oficiais (PDF/CSV).
        </p>
      </div>

      {/* KPIs. O âmbar de "Empates" só acende quando há resultado travado. */}
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
          tone={empates.length > 0 ? "amber" : "default"}
        />
      </div>

      {/* Aviso SLIM (uma linha) — encerrados sem NENHUM eleito. Vermelho só como
          ponto de acento no ícone, sem fundo saturado. Só aparece se houver. */}
      {semEleitoCount > 0 && (
        <a
          href="#vagas-sem-eleito"
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm transition hover:bg-slate-50"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500" />
          <span className="min-w-0 flex-1 text-slate-700">
            <strong className="font-semibold">{semEleitoCount}</strong>{" "}
            {semEleitoCount === 1
              ? "local encerrou sem nenhum eleito"
              : "locais encerraram sem nenhum eleito"}{" "}
            — revise e decida.
          </span>
          <span className="shrink-0 text-slate-400" aria-hidden>
            →
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

      {/* Ações & documentos — agrupadas por finalidade (menos "botões soltos").
          O primário é a Lista de Eleitos; o resto fica como opções outline. */}
      <Card>
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Lista de eleitos
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <ExportEleitosPdfButton ano={ano} />
              <ExportEleitosButton ano={ano} />
            </div>
          </div>

          <Separator />

          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Documentos & planilhas
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {data.apuracoes.length > 0 && (
                <ApuracaoPdfButton data={data} header={pdfHeader} variant="outline" />
              )}
              {data.apuracoes.length > 0 && (
                <RelatorioPendenciasButton data={data} header={pdfHeader} />
              )}
              <Button asChild variant="outline">
                <Link href="/admin/relatorios">
                  <FileText className="mr-2 h-4 w-4" />
                  Relatório por critério
                </Link>
              </Button>
            </div>
          </div>

          <Separator />

          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Atalhos
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button asChild variant="outline">
                <Link href="/admin/locais?status=closed">
                  <Building2 className="mr-2 h-4 w-4" />
                  Locais encerrados
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/transparencia" target="_blank">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Portal público
                </Link>
              </Button>
            </div>
          </div>
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
