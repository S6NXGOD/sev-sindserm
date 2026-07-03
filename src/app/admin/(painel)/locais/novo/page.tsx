import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { toDateTimeLocalValue } from "@/lib/format";
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
  const pleito = await prisma.election.findFirst({
    where: { ano },
    orderBy: [{ isEleicaoEspecial: "asc" }, { createdAt: "asc" }],
    select: {
      duracaoMandato: true,
      dataInicioGeral: true,
      dataFimGeral: true,
    },
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
            Defina o local, o órgão (lista fixa), a zona, o slug do link público,
            o limite de votos e a janela de votação.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateWorkplaceForm
            anoEleicao={ano}
            trienio={trienioLabel(ano, pleito?.duracaoMandato ?? 3)}
            inicioPadrao={
              pleito?.dataInicioGeral
                ? toDateTimeLocalValue(pleito.dataInicioGeral)
                : ""
            }
            fimPadrao={
              pleito?.dataFimGeral
                ? toDateTimeLocalValue(pleito.dataFimGeral)
                : ""
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
