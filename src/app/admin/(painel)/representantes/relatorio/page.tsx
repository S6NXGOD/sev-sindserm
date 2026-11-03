import Link from "next/link";
import { ChevronLeft, FileText } from "lucide-react";
import { prisma } from "@/lib/prisma";
import {
  getCurrentElectionYear,
  getElectionLogos,
  getSelectedElectionYear,
  requirePleito,
  tituloInstitucional,
} from "@/lib/election";
import { requireModule } from "@/lib/current-user";
import { pode } from "@/lib/permissions";
import { getRelatorioDiretoria } from "@/lib/relatorio-diretoria";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RelatorioDiretoriaView } from "@/components/admin/relatorio-diretoria-view";

export const dynamic = "force-dynamic";

/**
 * RELATÓRIO GERAL DA DIRETORIA — eleitos por zona (alfabético), com lotação e,
 * para quem tem acesso a Votantes (PII), o telefone cruzado dos votantes do
 * MESMO local. Ver = `encerradas` VIEW; telefone = `votantes` VIEW.
 */
export default async function RelatorioDiretoriaPage({
  searchParams,
}: {
  searchParams: { ano?: string };
}) {
  const user = await requireModule("encerradas", "VIEW");
  await requirePleito();
  const ano = getSelectedElectionYear(searchParams.ano);
  const anoVigente = getCurrentElectionYear();
  const canTel = pode(user.permissoes, "votantes", "VIEW");

  const election = await prisma.election.findFirst({
    where: { ano },
    orderBy: [{ isEleicaoEspecial: "asc" }, { createdAt: "asc" }],
    select: { id: true, titulo: true, duracaoMandato: true },
  });

  const [relatorio, logos] = await Promise.all([
    election ? getRelatorioDiretoria(election.id, canTel) : Promise.resolve(null),
    getElectionLogos(ano),
  ]);

  const geradoEm = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Fortaleza",
  }).format(new Date());

  const pdfHeader = {
    logoSindserm: logos.sindserm,
    logoPleito: logos.pleito,
    tituloPleito: tituloInstitucional(
      election?.titulo,
      ano,
      election?.duracaoMandato ?? 3,
    ),
    geradoEm,
  };

  return (
    <div className="space-y-5">
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link href="/admin/representantes">
          <ChevronLeft className="mr-1 h-4 w-4" />
          Voltar para Representantes
        </Link>
      </Button>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Relatório geral da diretoria
        </h1>
        <p className="text-sm text-muted-foreground">
          Representantes eleitos {ano}
          {ano !== anoVigente ? " (histórico)" : ""} — nome, lotação e zona,
          organizados por zona e em ordem alfabética
          {canTel ? ", com telefone cruzado dos votantes" : ""}.
        </p>
      </div>

      {!relatorio || relatorio.rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <FileText className="h-8 w-8 text-muted-foreground/40" />
            <p className="max-w-md text-sm text-muted-foreground">
              Nenhum representante eleito ainda. Assim que os locais encerrarem,
              o relatório é montado aqui automaticamente.
            </p>
          </CardContent>
        </Card>
      ) : (
        <RelatorioDiretoriaView
          rows={relatorio.rows}
          incluiTelefone={relatorio.incluiTelefone}
          totalZonas={relatorio.totalZonas}
          comTelefone={relatorio.comTelefone}
          pdfHeader={pdfHeader}
        />
      )}

      {!canTel && (
        <p className="text-xs text-muted-foreground">
          O telefone dos representantes fica disponível para quem tem acesso ao
          módulo <strong>Votantes</strong> (dado pessoal — LGPD).
        </p>
      )}
    </div>
  );
}
