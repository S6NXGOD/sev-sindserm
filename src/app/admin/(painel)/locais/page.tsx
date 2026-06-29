import Link from "next/link";
import { headers } from "next/headers";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type { Prisma, Zona } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PAGE_SIZE } from "@/lib/constants";
import { calcularVagas } from "@/lib/vagas";
import {
  getCurrentElectionYear,
  getSelectedElectionYear,
  requirePleito,
} from "@/lib/election";
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
import { WorkplacesFilterBar } from "@/components/admin/workplaces-filter-bar";
import { CopyButton } from "@/components/admin/copy-button";

export const dynamic = "force-dynamic";

const BASE = "/admin/locais";

type SearchParams = {
  q?: string;
  zona?: string;
  orgao?: string;
  status?: string;
  page?: string;
  ano?: string;
};

function buildWhere(
  sp: SearchParams,
  anoEleicao: number,
): Prisma.WorkplaceWhereInput {
  const now = new Date();
  const AND: Prisma.WorkplaceWhereInput[] = [{ anoEleicao }];

  if (sp.q) {
    AND.push({
      OR: [
        { nome: { contains: sp.q, mode: "insensitive" } },
        { linkToken: { contains: sp.q, mode: "insensitive" } },
      ],
    });
  }
  if (sp.zona) AND.push({ zona: sp.zona as Zona });
  if (sp.orgao) AND.push({ orgao: sp.orgao });

  if (sp.status === "open") {
    AND.push({ dataInicioVotacao: { lte: now }, dataFimVotacao: { gte: now } });
  } else if (sp.status === "upcoming") {
    AND.push({ dataInicioVotacao: { gt: now } });
  } else if (sp.status === "closed") {
    AND.push({ dataFimVotacao: { lt: now } });
  }

  return { AND };
}

function statusBadge(inicio: Date, fim: Date) {
  const now = new Date();
  if (now < inicio) return <Badge variant="secondary">Não iniciada</Badge>;
  if (now > fim) return <Badge variant="destructive">Encerrada</Badge>;
  return <Badge variant="success">Aberta</Badge>;
}

function pageHref(sp: SearchParams, page: number) {
  const params = new URLSearchParams();
  if (sp.q) params.set("q", sp.q);
  if (sp.zona) params.set("zona", sp.zona);
  if (sp.orgao) params.set("orgao", sp.orgao);
  if (sp.status) params.set("status", sp.status);
  if (sp.ano) params.set("ano", sp.ano);
  params.set("page", String(page));
  return `${BASE}?${params.toString()}`;
}

export default async function LocaisPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const h = headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const votingBaseUrl = `${proto}://${host}`;

  await requirePleito();
  const ano = getSelectedElectionYear(searchParams.ano);
  const anoVigente = getCurrentElectionYear();
  const page = Math.max(1, Number(searchParams.page) || 1);
  const where = buildWhere(searchParams, ano);

  const [total, filtered, workplaces] = await Promise.all([
    prisma.workplace.count({ where: { anoEleicao: ano } }),
    prisma.workplace.count({ where }),
    prisma.workplace.findMany({
      where,
      orderBy: { nome: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { _count: { select: { votes: true, candidates: true } } },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Locais de Trabalho
          </h1>
          <p className="text-sm text-muted-foreground">
            Eleição {ano}
            {ano !== anoVigente ? " (histórico)" : ""} · {filtered} resultado(s){" "}
            {filtered !== total ? `de ${total} no total` : ""}
          </p>
        </div>
        <Button asChild>
          <Link href={`${BASE}/novo?ano=${ano}`}>
            <Plus className="mr-2 h-4 w-4" />
            Cadastrar local
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Buscar e filtrar</CardTitle>
          <CardDescription>
            Filtre por nome, órgão, zona e status da votação.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <WorkplacesFilterBar basePath={BASE} />

          {/* DESKTOP (lg+): tabela completa — intacta. */}
          <div className="hidden rounded-md border lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Local</TableHead>
                  <TableHead>Órgão</TableHead>
                  <TableHead>Zona</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Cand.</TableHead>
                  <TableHead className="text-center">Vagas</TableHead>
                  <TableHead className="text-center">Votos</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workplaces.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="py-10 text-center text-muted-foreground"
                    >
                      Nenhum local encontrado com os filtros atuais.
                    </TableCell>
                  </TableRow>
                ) : (
                  workplaces.map((w) => (
                    <TableRow key={w.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`${BASE}/${w.id}`}
                          className="hover:underline"
                        >
                          {w.nome}
                        </Link>
                        <div className="font-mono text-xs text-muted-foreground">
                          /votacao/{w.linkToken}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate text-sm text-muted-foreground">
                        {w.orgao}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{w.zona}</Badge>
                      </TableCell>
                      <TableCell>
                        {statusBadge(w.dataInicioVotacao, w.dataFimVotacao)}
                      </TableCell>
                      <TableCell className="text-center">
                        {w._count.candidates}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">
                          {calcularVagas(w._count.candidates)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        {w._count.votes}
                        {w.voteLimit ? (
                          <span className="text-muted-foreground">
                            /{w.voteLimit}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <CopyButton
                            value={`${votingBaseUrl}/votacao/${w.linkToken}`}
                            size="icon"
                          />
                          <Button asChild variant="ghost" size="sm">
                            <Link href={`${BASE}/${w.id}`}>Gerenciar</Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* MOBILE (< lg): cada local vira um cartão. */}
          <div className="space-y-3 lg:hidden">
            {workplaces.length === 0 ? (
              <div className="rounded-md border py-8 text-center text-sm text-muted-foreground">
                Nenhum local encontrado com os filtros atuais.
              </div>
            ) : (
              workplaces.map((w) => (
                <div
                  key={w.id}
                  className="rounded-lg border bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`${BASE}/${w.id}`}
                        className="font-medium hover:underline"
                      >
                        {w.nome}
                      </Link>
                      <div className="truncate font-mono text-xs text-muted-foreground">
                        /votacao/{w.linkToken}
                      </div>
                    </div>
                    <div className="shrink-0">
                      {statusBadge(w.dataInicioVotacao, w.dataFimVotacao)}
                    </div>
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant="outline" className="shrink-0">
                      {w.zona}
                    </Badge>
                    <p className="min-w-0 truncate text-sm text-muted-foreground">
                      {w.orgao}
                    </p>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-md bg-slate-50 py-1.5">
                      <div className="font-semibold text-foreground">
                        {w._count.candidates}
                      </div>
                      <div className="text-muted-foreground">Cand.</div>
                    </div>
                    <div className="rounded-md bg-slate-50 py-1.5">
                      <div className="font-semibold text-foreground">
                        {calcularVagas(w._count.candidates)}
                      </div>
                      <div className="text-muted-foreground">Vagas</div>
                    </div>
                    <div className="rounded-md bg-slate-50 py-1.5">
                      <div className="font-semibold text-foreground">
                        {w._count.votes}
                        {w.voteLimit ? `/${w.voteLimit}` : ""}
                      </div>
                      <div className="text-muted-foreground">Votos</div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-end gap-1 border-t pt-3">
                    <CopyButton
                      value={`${votingBaseUrl}/votacao/${w.linkToken}`}
                      size="icon"
                    />
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`${BASE}/${w.id}`}>Gerenciar</Link>
                    </Button>
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
