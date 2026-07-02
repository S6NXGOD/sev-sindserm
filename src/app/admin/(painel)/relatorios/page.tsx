import { prisma } from "@/lib/prisma";
import { getReportData, type Apuracao } from "@/lib/reports";
import {
  getCurrentElectionYear,
  getElectionLogos,
  getSelectedElectionYear,
  requirePleito,
  tituloInstitucional,
} from "@/lib/election";
import { Badge } from "@/components/ui/badge";
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

export const dynamic = "force-dynamic";

type SearchParams = {
  tipo?: string;
  orgao?: string;
  localId?: string;
  zona?: string;
  ano?: string;
};

const STATUS_LABEL: Record<Apuracao["status"], string> = {
  open: "Em andamento",
  closed: "Encerrada",
  upcoming: "Não iniciada",
};

const STATUS_VARIANT: Record<
  Apuracao["status"],
  "success" | "destructive" | "secondary"
> = {
  open: "success",
  closed: "destructive",
  upcoming: "secondary",
};

const MAX_ELEITOS_NOMES = 8;

function ApuracaoBlock({ a }: { a: Apuracao }) {
  const semVotos = a.totalVotos === 0;
  const eleitosMostrados = a.eleitos.slice(0, MAX_ELEITOS_NOMES);
  const eleitosRestantes = a.eleitos.length - eleitosMostrados.length;
  const empatadosMostrados = a.empatados.slice(0, MAX_ELEITOS_NOMES);
  const semVotosCount = a.totalCandidatos - a.votadosCount;
  const naoListados = a.votadosCount - a.ranking.length;

  return (
    <Card className="break-inside-avoid">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{a.nome}</CardTitle>
            <p className="text-xs text-muted-foreground">
              {a.orgao} · Zona {a.zona}
            </p>
          </div>
          <Badge variant={STATUS_VARIANT[a.status]}>
            {STATUS_LABEL[a.status]}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Janela: {a.inicioDisplay} até {a.fimDisplay} ·{" "}
          {a.totalCandidatos} candidato(s) · {a.vagas}{" "}
          {a.vagas === 1 ? "vaga" : "vagas"} · {a.totalVotos}{" "}
          {a.totalVotos === 1 ? "voto" : "votos"}
          {a.voteLimit ? ` (limite ${a.voteLimit})` : ""}
        </p>
        {semVotos ? (
          <p className="text-sm text-muted-foreground">Sem votos.</p>
        ) : (
          <div className="text-sm">
            {a.eleitos.length > 0 && (
              <p className="font-medium text-emerald-700">
                {a.status === "closed" ? "Eleito(s)" : "Parcial (projeção)"}:{" "}
                {eleitosMostrados.join(", ")}
                {eleitosRestantes > 0 ? ` +${eleitosRestantes}` : ""}
              </p>
            )}
            {a.temEmpate && (
              <p className="font-medium text-amber-700">
                Empate para {a.vagasEmDisputa}{" "}
                {a.vagasEmDisputa === 1 ? "vaga" : "vagas"}:{" "}
                {empatadosMostrados.join(", ")} — necessário desempate.
              </p>
            )}
          </div>
        )}
      </CardHeader>

      {!semVotos && (
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Candidato</TableHead>
                <TableHead className="text-right">Votos</TableHead>
                <TableHead className="text-right">%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {a.ranking.map((c, i) => (
                <TableRow key={`${a.id}-${i}`}>
                  <TableCell className={c.eleito ? "font-semibold" : undefined}>
                    <span className="inline-flex items-center gap-2">
                      {i + 1}. {c.nome}
                      {c.eleito ? (
                        <Badge variant="success">Eleito</Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-sky-300 text-sky-700"
                        >
                          Suplente
                        </Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">{c.votos}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {c.pct}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {(naoListados > 0 || semVotosCount > 0) && (
            <p className="mt-2 text-xs text-muted-foreground">
              {naoListados > 0 &&
                `+${naoListados} candidato(s) com votos não listados. `}
              {semVotosCount > 0 &&
                `${semVotosCount} candidato(s) sem votos.`}
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Relatórios</h1>
          <p className="text-sm text-muted-foreground">
            Apuração da eleição {ano}
            {ano !== anoVigente ? " (histórico — auditoria)" : ""}. Selecione o
            tipo e use “Imprimir / Salvar PDF”.
          </p>
        </div>
        <ExportEleitosButton ano={ano} />
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

          {/* Apurações por local */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold print:hidden">
              Apuração por local ({data.apuracoes.length})
            </h2>
            {data.apuracoes.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground">
                  Nenhum local encontrado para este relatório.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2 print:grid-cols-1">
                {data.apuracoes.map((a) => (
                  <ApuracaoBlock key={a.id} a={a} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
