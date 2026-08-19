import Link from "next/link";
import { FileText, ListChecks } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getReportData } from "@/lib/reports";
import {
  getCurrentElectionYear,
  getElectionLogos,
  getSelectedElectionYear,
  requirePleito,
  tituloInstitucional,
} from "@/lib/election";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ReportControls } from "@/components/admin/report-controls";
import { ExportEleitosButton } from "@/components/admin/export-eleitos-button";
import { ApuracaoPdfButton } from "@/components/admin/apuracao-pdf-button";

export const dynamic = "force-dynamic";

type SearchParams = {
  tipo?: string;
  orgao?: string;
  localId?: string;
  zona?: string;
  ano?: string;
};

const ZONA_VALUES = new Set([
  "SUL",
  "LESTE",
  "SUDESTE",
  "NORTE",
  "CENTRO",
  "RURAL",
]);


export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requirePleito();
  const tipo = searchParams.tipo ?? "geral";
  const ano = getSelectedElectionYear(searchParams.ano);
  const anoVigente = getCurrentElectionYear();

  const opts: {
    anoEleicao: number;
    orgao?: string;
    zona?: string;
    localId?: string;
    somenteEncerradas?: boolean;
  } = { anoEleicao: ano };
  let tituloRelatorio = "Relatório Geral de Apuração";
  let filtroDescricao = "Todos os locais de trabalho";

  if (tipo === "orgao") {
    tituloRelatorio = "Relatório por Órgão";
    if (searchParams.orgao) {
      opts.orgao = searchParams.orgao;
      filtroDescricao = `Órgão: ${searchParams.orgao}`;
    } else {
      filtroDescricao = "Todos os órgãos";
    }
  } else if (tipo === "zona") {
    tituloRelatorio = "Relatório por Zona";
    if (searchParams.zona && ZONA_VALUES.has(searchParams.zona)) {
      opts.zona = searchParams.zona;
      filtroDescricao = `Zona: ${searchParams.zona}`;
    } else {
      filtroDescricao = "Todas as zonas";
    }
  } else if (tipo === "local") {
    tituloRelatorio = "Relatório por Local de Trabalho";
    if (searchParams.localId) opts.localId = searchParams.localId;
  } else if (tipo === "encerradas") {
    tituloRelatorio = "Relatório de Votações Encerradas";
    filtroDescricao = "Apenas votações encerradas";
    opts.somenteEncerradas = true;
  }

  const [selectedLocal, logos, pleito] = await Promise.all([
    // Autocomplete de local é server-side; só resolvemos o nome do selecionado.
    searchParams.localId
      ? prisma.workplace.findUnique({
          where: { id: searchParams.localId },
          select: { nome: true },
        })
      : Promise.resolve(null),
    getElectionLogos(ano),
    // `ano` não é único (eleições especiais) — usa o pleito REGULAR do ano.
    prisma.election.findFirst({
      where: { ano },
      orderBy: [{ isEleicaoEspecial: "asc" }, { createdAt: "asc" }],
      select: { titulo: true, duracaoMandato: true, emailOficial: true },
    }),
  ]);
  const selectedLocalNome = selectedLocal?.nome ?? "";
  const duracao = pleito?.duracaoMandato ?? 3;
  const emailOficial = pleito?.emailOficial?.trim() || null;

  const precisaSelecionarLocal = tipo === "local" && !searchParams.localId;
  const data = precisaSelecionarLocal ? null : await getReportData(opts);
  const mostrarResumo = tipo !== "local";

  // Cabeçalho do PDF consolidado (gerado no cliente a partir de `data`).
  const pdfHeader = {
    logoSindserm: logos.sindserm,
    logoPleito: logos.pleito,
    tituloPleito: tituloInstitucional(pleito?.titulo, ano, duracao),
    subtitulo: tituloRelatorio,
    filtro: filtroDescricao,
    geradoEm: data?.geradoEmDisplay ?? "",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Relatórios</h1>
          <p className="text-sm text-muted-foreground">
            Apuração da eleição {ano}
            {ano !== anoVigente ? " (histórico — auditoria)" : ""}. Escolha o
            critério e gere o documento oficial (PDF ou CSV).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {data && <ApuracaoPdfButton data={data} header={pdfHeader} />}
          <ExportEleitosButton ano={ano} />
        </div>
      </div>

      <ReportControls ano={ano} selectedLocalNome={selectedLocalNome} />

      {/* Cabeçalho oficial da ata/relatório (visível na impressão) */}
      <div className="rounded-lg border bg-white p-4 sm:p-6">
        <div className="flex flex-col items-center gap-4 border-b pb-4 sm:flex-row sm:justify-between print:flex-row print:justify-between">
          {/* Esquerda: logo do SINDSERM do pleito */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logos.sindserm}
            alt="Logo SINDSERM"
            className="h-14 w-auto max-w-[160px] object-contain"
          />
          {/* Centro: título institucional + dados da apuração */}
          <div className="flex-1 text-center">
            <p className="text-lg font-bold">SEV SINDSERM</p>
            <p className="text-xs text-muted-foreground">
              Sistema Eletrônico de Votação do SINDSERM
            </p>
            <p className="mt-1 text-sm font-medium">
              {tituloInstitucional(pleito?.titulo, ano, duracao)}
            </p>
            <p className="text-xs text-muted-foreground">{tituloRelatorio}</p>
          </div>
          {/* Direita: logo do pleito (regra estrita — sem fallback).
              Sem logo do pleito, um espaçador de mesma largura mantém o título
              centralizado e o cabeçalho simétrico (só com a logo do SINDSERM). */}
          {logos.pleito ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logos.pleito}
              alt="Logo do pleito"
              className="h-14 w-14 shrink-0 object-contain"
            />
          ) : (
            <div className="hidden h-14 w-14 shrink-0 sm:block print:block" aria-hidden />
          )}
        </div>
        <div className="flex flex-wrap justify-between gap-2 pt-3 text-xs text-muted-foreground">
          <span>{filtroDescricao}</span>
          {data && <span>Gerado em {data.geradoEmDisplay}</span>}
        </div>
        {emailOficial && (
          <p className="pt-2 text-xs text-muted-foreground">
            Envio de atas e documentos oficiais:{" "}
            <a
              href={`mailto:${emailOficial}`}
              className="font-medium text-primary"
            >
              {emailOficial}
            </a>
          </p>
        )}
      </div>

      {precisaSelecionarLocal && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Selecione um local de trabalho acima para gerar o relatório.
          </CardContent>
        </Card>
      )}

      {data && (
        <>
          {mostrarResumo && (
            <Card className="break-inside-avoid">
              <CardHeader>
                <CardTitle className="text-base">Resumo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  {[
                    { l: "Locais", v: data.summary.totalLocais },
                    { l: "Votos", v: data.summary.totalVotos },
                    { l: "Em andamento", v: data.summary.abertas },
                    { l: "Encerradas", v: data.summary.encerradas },
                    { l: "Não iniciadas", v: data.summary.naoIniciadas },
                  ].map((k) => (
                    <div key={k.l} className="rounded-md border p-3">
                      <p className="text-2xl font-bold leading-none">{k.v}</p>
                      <p className="text-xs text-muted-foreground">{k.l}</p>
                    </div>
                  ))}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="mb-2 text-sm font-medium">Votos por órgão</p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Órgão</TableHead>
                          <TableHead className="text-center">Locais</TableHead>
                          <TableHead className="text-right">Votos</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.summary.porOrgao.map((o) => (
                          <TableRow key={o.orgao}>
                            <TableCell className="max-w-[150px] truncate text-sm sm:max-w-[260px]">
                              {o.orgao}
                            </TableCell>
                            <TableCell className="text-center">
                              {o.locais}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {o.votos}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-medium">Votos por zona</p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Zona</TableHead>
                          <TableHead className="text-right">Votos</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.summary.porZona.map((z) => (
                          <TableRow key={z.zona}>
                            <TableCell>{z.zona}</TableCell>
                            <TableCell className="text-right font-medium">
                              {z.votos}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* O documento (PDF) contém a apuração local a local; a tela NÃO
              despeja a lista inteira (era a "rolagem sem fim"). Para NAVEGAR
              os resultados, o lugar certo é "Encerradas & Eleitos". */}
          {data.apuracoes.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                Nenhum local encontrado para este critério.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <FileText className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
                  <div>
                    <p className="font-medium">
                      Documento pronto: {data.apuracoes.length} local(is) neste
                      critério.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Gere o <strong>PDF</strong> (apuração completa, com eleitos e
                      ranking por local) ou a planilha <strong>CSV</strong> de
                      eleitos nos botões acima.
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <ApuracaoPdfButton data={data} header={pdfHeader} />
                  <Button asChild variant="outline">
                    <Link href="/admin/encerradas">
                      <ListChecks className="mr-2 h-4 w-4" />
                      Navegar local a local
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
