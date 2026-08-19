import Link from "next/link";
import { ChevronLeft, ChevronRight, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PAGE_SIZE } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import {
  getCurrentElectionYear,
  getSelectedElectionYear,
  requirePleito,
} from "@/lib/election";
import { requireModule } from "@/lib/current-user";
import { buildVoterWhere } from "@/lib/voter-filters";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
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
import { VotersFilterBar } from "@/components/admin/voters-filter-bar";
import { ExportVotersButton } from "@/components/admin/export-voters-button";

export const dynamic = "force-dynamic";

const BASE = "/admin/votantes";

type SearchParams = {
  q?: string;
  zona?: string;
  orgao?: string;
  localId?: string;
  filiacao?: string;
  page?: string;
  ano?: string;
};

function pageHref(sp: SearchParams, page: number) {
  const params = new URLSearchParams();
  if (sp.q) params.set("q", sp.q);
  if (sp.zona) params.set("zona", sp.zona);
  if (sp.orgao) params.set("orgao", sp.orgao);
  if (sp.localId) params.set("localId", sp.localId);
  if (sp.filiacao) params.set("filiacao", sp.filiacao);
  if (sp.ano) params.set("ano", sp.ano);
  params.set("page", String(page));
  return `${BASE}?${params.toString()}`;
}

export default async function VotantesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireModule("votantes", "VIEW");
  await requirePleito();
  const ano = getSelectedElectionYear(searchParams.ano);
  const anoVigente = getCurrentElectionYear();
  const page = Math.max(1, Number(searchParams.page) || 1);
  const where = buildVoterWhere({
    anoEleicao: ano,
    q: searchParams.q,
    zona: searchParams.zona,
    orgao: searchParams.orgao,
    localId: searchParams.localId,
    filiacao: searchParams.filiacao,
  });

  const [total, filtered, filiados, voters, selectedLocal] = await Promise.all([
    prisma.voter.count({ where: { anoEleicao: ano } }),
    prisma.voter.count({ where }),
    prisma.voter.count({ where: { ...where, isFiliado: true } }),
    prisma.voter.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        nome: true,
        telefone: true,
        isFiliado: true,
        createdAt: true,
        workplace: {
          select: { id: true, nome: true, orgao: true, zona: true },
        },
      },
    }),
    // Autocomplete de local é server-side (WorkplaceCombobox); aqui só
    // resolvemos o NOME do local selecionado (se houver) para exibir no filtro.
    searchParams.localId
      ? prisma.workplace.findUnique({
          where: { id: searchParams.localId },
          select: { nome: true },
        })
      : Promise.resolve(null),
  ]);

  const selectedLocalNome = selectedLocal?.nome ?? "";
  const totalPages = Math.max(1, Math.ceil(filtered / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Users className="h-6 w-6" />
            Votantes
          </h1>
          <p className="text-sm text-muted-foreground">
            Eleição {ano}
            {ano !== anoVigente ? " (histórico)" : ""} · {filtered} votante(s){" "}
            {filtered !== total ? `de ${total} no total` : ""} ·{" "}
            <strong>{filiados}</strong> filiado(s) no resultado. O voto escolhido{" "}
            <strong>não</strong> é exibido (sigilo preservado).
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Filtrar votantes</CardTitle>
              <CardDescription>
                Filtre por filiação, local, zona, órgão e nome — e exporte para
                campanhas de filiação.
              </CardDescription>
            </div>
            <ExportVotersButton ano={ano} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <VotersFilterBar ano={ano} selectedLocalNome={selectedLocalNome} />

          {/* DESKTOP (lg+): tabela completa — intacta. */}
          <div className="hidden rounded-md border lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Votante</TableHead>
                  <TableHead>Filiação</TableHead>
                  <TableHead>Local de Trabalho</TableHead>
                  <TableHead>Órgão</TableHead>
                  <TableHead>Zona</TableHead>
                  <TableHead className="text-right">Horário do voto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {voters.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-10 text-center text-muted-foreground"
                    >
                      Nenhum votante encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  voters.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-medium">{v.nome}</TableCell>
                      <TableCell>
                        {v.isFiliado ? (
                          <Badge variant="success">Filiado</Badge>
                        ) : (
                          <Badge variant="outline">Não filiado</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/admin/locais/${v.workplace.id}`}
                          className="text-sm hover:underline"
                        >
                          {v.workplace.nome}
                        </Link>
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate text-sm text-muted-foreground">
                        {v.workplace.orgao}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{v.workplace.zona}</Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {formatDateTime(v.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* MOBILE (< lg): cada votante vira um cartão. */}
          <div className="space-y-3 lg:hidden">
            {voters.length === 0 ? (
              <div className="rounded-md border py-8 text-center text-sm text-muted-foreground">
                Nenhum votante encontrado.
              </div>
            ) : (
              voters.map((v) => (
                <div
                  key={v.id}
                  className="rounded-lg border bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 break-words font-medium">{v.nome}</p>
                    <div className="shrink-0">
                      {v.isFiliado ? (
                        <Badge variant="success">Filiado</Badge>
                      ) : (
                        <Badge variant="outline">Não filiado</Badge>
                      )}
                    </div>
                  </div>

                  <div className="mt-2">
                    <Link
                      href={`/admin/locais/${v.workplace.id}`}
                      className="text-sm hover:underline"
                    >
                      {v.workplace.nome}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">
                      {v.workplace.orgao}
                    </p>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
                    <Badge variant="outline">{v.workplace.zona}</Badge>
                    <span>{formatDateTime(v.createdAt)}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Página {page} de {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                asChild={page > 1}
                variant="outline"
                size="sm"
                disabled={page <= 1}
              >
                {page > 1 ? (
                  <Link href={pageHref(searchParams, page - 1)}>
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Anterior
                  </Link>
                ) : (
                  <span>
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Anterior
                  </span>
                )}
              </Button>
              <Button
                asChild={page < totalPages}
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
              >
                {page < totalPages ? (
                  <Link href={pageHref(searchParams, page + 1)}>
                    Próxima
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Link>
                ) : (
                  <span>
                    Próxima
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </span>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
