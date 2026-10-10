import Link from "next/link";
import {
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
import { SecaoRecolhivel } from "@/components/admin/secao-recolhivel";

export const dynamic = "force-dynamic";

/** Item do resumo slim (ícone + número + rótulo numa faixa única e enxuta). */
function ResumoItem({
  icon: Icon,
  tone,
  value,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  value: number;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className={`h-5 w-5 shrink-0 ${tone}`} />
      <span className="text-xl font-bold leading-none text-slate-900">
        {value.toLocaleString("pt-BR")}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

/**
 * RESULTADOS & RELATÓRIOS — redesenho "lista primeiro".
 * A ordem agora prioriza ACHAR UM LOCAL e VER OS ELEITOS: resumo enxuto →
 * (pendências recolhidas, só 1 barra) → a LISTA buscável com chips de status e
 * linha de suplência por local → (documentos/exportações recolhidos no fim).
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

  const temPendencias =
    empates.length > 0 ||
    vagaVaziaPendentes.length > 0 ||
    vagaVaziaAceitas.length > 0;
  const aDecidir = empates.length + vagaVaziaPendentes.length;

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
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Resultados &amp; Relatórios
        </h1>
        <p className="text-sm text-muted-foreground">
          Eleição {ano}
          {ano !== anoVigente ? " (histórico — auditoria)" : ""} — ache um local,
          veja os eleitos e a suplência. Pendências e documentos ficam logo
          abaixo.
        </p>
      </div>

      {/* Resumo enxuto numa faixa só (sem torre de cards). */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5 rounded-xl border bg-card px-4 py-3 shadow-sm sm:px-5">
        <ResumoItem
          icon={CheckCircle2}
          tone="text-emerald-600"
          value={data.apuracoes.length}
          label="locais encerrados"
        />
        <ResumoItem
          icon={Award}
          tone="text-sky-600"
          value={totalEleitos}
          label="eleitos"
        />
        <ResumoItem
          icon={Vote}
          tone="text-slate-500"
          value={totalVotos}
          label="votos apurados"
        />
        <ResumoItem
          icon={Scale}
          tone={empates.length > 0 ? "text-amber-600" : "text-slate-400"}
          value={empates.length}
          label="empates a resolver"
        />
      </div>

      {/* PENDÊNCIAS — uma barra recolhida (não empurra mais a lista para baixo).
          Abre com 1 toque; o contador âmbar sinaliza o que precisa de decisão. */}
      {temPendencias && (
        <SecaoRecolhivel
          titulo="Pendências a resolver"
          descricao="Empates e vagas sem eleito — decida local a local (reversível)."
          icon={<Scale className="h-5 w-5" />}
          defaultOpen={false}
          badge={
            aDecidir > 0 ? (
              <span className="flex flex-wrap items-center justify-end gap-1.5">
                {empates.length > 0 && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
                    {empates.length} empate{empates.length > 1 ? "s" : ""}
                  </span>
                )}
                {vagaVaziaPendentes.length > 0 && (
                  <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-600">
                    {vagaVaziaPendentes.length} a decidir
                  </span>
                )}
              </span>
            ) : (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">
                em dia
              </span>
            )
          }
        >
          <div className="space-y-4">
            <EmpatesPanel empates={empates} />
            <VagasVaziasPanel
              pendentes={vagaVaziaPendentes}
              aceitas={vagaVaziaAceitas}
            />
          </div>
        </SecaoRecolhivel>
      )}

      {/* LISTA — o herói da página: busca + chips de status + eleitos/suplência. */}
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
          showStatusChips
          pdfHeader={pdfHeader}
        />
      )}

      {/* DOCUMENTOS & EXPORTAÇÕES — recolhido no fim (não é a tarefa principal). */}
      <SecaoRecolhivel
        titulo="Documentos e exportações"
        descricao="Lista de eleitos, apuração e relatórios (PDF/CSV)."
        icon={<FileText className="h-5 w-5" />}
        defaultOpen={false}
      >
        <div className="space-y-4">
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
        </div>
      </SecaoRecolhivel>
    </div>
  );
}
