import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import {
  getSelectedElectionYear,
  requirePleito,
  trienioLabel,
} from "@/lib/election";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreateWorkplaceForm } from "@/components/admin/create-workplace-form";

export const dynamic = "force-dynamic";

export default async function NovoLocalPage({
  searchParams,
}: {
  searchParams: { ano?: string };
}) {
  await requirePleito();
  // Pleito do contexto (cookie da sidebar, com override ?ano= para deep-link).
  const ano = getSelectedElectionYear(searchParams.ano);
  // `ano` não é único (eleições especiais) — usa o pleito REGULAR do ano.
  // As datas GERAIS do pleito não são mais lidas aqui: o local não herda janela
  // (nasce "Aguardando Agendamento"); a diretoria agenda ao visitar o local.
  const pleito = await prisma.election.findFirst({
    where: { ano },
    orderBy: [{ isEleicaoEspecial: "asc" }, { createdAt: "asc" }],
    select: { duracaoMandato: true },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/admin/locais">
          <ChevronLeft className="mr-1 h-4 w-4" />
          Voltar para a lista
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">
            Cadastrar Local de Trabalho
          </CardTitle>
          <CardDescription>
            Defina o local, o órgão (lista fixa), a zona, o slug do link público
            e o limite de votos. A janela de votação é agendada depois, na página
            do local, quando a diretoria visitá-lo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateWorkplaceForm
            anoEleicao={ano}
            trienio={trienioLabel(ano, pleito?.duracaoMandato ?? 3)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
