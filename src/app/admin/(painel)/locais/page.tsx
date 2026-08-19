import Link from "next/link";
import { headers } from "next/headers";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type { Prisma, Zona } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PAGE_SIZE } from "@/lib/constants";
import { searchScore, searchTokens } from "@/lib/slug";
import { votingStatus } from "@/lib/voting-status";
import { calcularVagas } from "@/lib/vagas";
import {
  getCurrentElectionYear,
  getSelectedElectionYear,
  requirePleito,
} from "@/lib/election";
import { requireModule } from "@/lib/current-user";
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
import { ReportGenerator } from "@/components/admin/report-generator";

export const dynamic = "force-dynamic";

const BASE = "/admin/locais";

type SearchParams = {
  q?: string;
  zona?: string;
  orgao?: string;
  status?: string;
  sort?: string;
  page?: string;
  ano?: string;
};

/**
 * Ordenação da listagem por CICLO DE VIDA da votação (não só cadastro):
 * datas nulas (sem janela) vão para o fim nas ordenações por data.
 */
function buildOrderBy(
  sort?: string,
): Prisma.WorkplaceOrderByWithRelationInput {
  switch (sort) {
    case "nome":
      return { nome: "asc" };
    case "antigos":
      return { createdAt: "asc" };
    case "fim_desc": // encerramento mais recente primeiro
      return { dataFimVotacao: { sort: "desc", nulls: "last" } };
    case "inicio_desc": // abertura mais recente primeiro
      return { dataInicioVotacao: { sort: "desc", nulls: "last" } };
    case "votos": // mais votados primeiro
      return { votes: { _count: "desc" } };
    default: // "recentes" = recém-CADASTRADOS no topo
      return { createdAt: "desc" };
  }
}

// Sorts por CICLO DE VIDA ("Abertura recente" / "Encerramento recente"). O
// orderBy simples do banco (data desc) colocava os locais AGENDADOS PARA O
// FUTURO no topo — mas algo que ainda vai abrir/encerrar não é "recente". Aqui
// ordenamos por semântica: 1º os que JÁ aconteceram (passado, mais recente
// primeiro); depois os FUTUROS (mais próximos primeiro); por fim os SEM data.
type LifecycleSort = "inicio_desc" | "fim_desc";

function isLifecycleSort(sort?: string): sort is LifecycleSort {
  return sort === "inicio_desc" || sort === "fim_desc";
}

function ordenarPorCiclo<
  T extends {
    dataInicioVotacao: Date | null;
    dataFimVotacao: Date | null;
    createdAt: Date;
  },
>(list: T[], sort: LifecycleSort, now: Date): T[] {
  const nowMs = now.getTime();
  const dataDe = (w: T) =>
    (sort === "fim_desc" ? w.dataFimVotacao : w.dataInicioVotacao)?.getTime() ??
    null;
  // 0 = já aconteceu (passado), 1 = agendado (futuro), 2 = sem data.
  const cat = (d: number | null) => (d === null ? 2 : d <= nowMs ? 0 : 1);

  return [...list].sort((a, b) => {
    const da = dataDe(a);
    const db = dataDe(b);
    const ca = cat(da);
    const cb = cat(db);
    if (ca !== cb) return ca - cb;
    if (ca === 2) return b.createdAt.getTime() - a.createdAt.getTime(); // sem data: cadastro recente
    if (ca === 0) return (db as number) - (da as number); // passado: mais recente primeiro
    return (da as number) - (db as number); // futuro: mais próximo primeiro
  });
}

// A busca textual (`q`) NÃO entra aqui: é feita em memória (por tokens, acento/
// caixa/ordem-insensível) no componente, pois o `contains` do Postgres é
// sensível a acento e só casa substring contígua. Aqui ficam só os filtros
// exatos (zona/órgão/status), que o banco resolve bem.
function buildWhere(
  sp: SearchParams,
  anoEleicao: number,
): Prisma.WorkplaceWhereInput {
  const now = new Date();
  const AND: Prisma.WorkplaceWhereInput[] = [{ anoEleicao }];

  if (sp.zona) AND.push({ zona: sp.zona as Zona });
  if (sp.orgao) AND.push({ orgao: sp.orgao });

  // Os 4 status. Datas null nunca casam com lte/gt/lt no SQL, então os locais
  // "Aguardando agendamento" só aparecem no filtro `undefined` — nunca em
  // "upcoming" (que agora significa "agendada para o futuro").
  if (sp.status === "open") {
    AND.push({ dataInicioVotacao: { lte: now }, dataFimVotacao: { gte: now } });
  } else if (sp.status === "upcoming") {
    AND.push({ dataInicioVotacao: { gt: now } });
  } else if (sp.status === "closed") {
    AND.push({ dataFimVotacao: { lt: now } });
  } else if (sp.status === "undefined") {
    AND.push({ dataInicioVotacao: null });
  }

  return { AND };
}

/** Badge dos 4 status. Sem janela agendada = "Aguardando" (âmbar). */
function statusBadge(inicio: Date | null, fim: Date | null) {
  switch (votingStatus(inicio, fim)) {
    case "undefined":
      return (
        <Badge
          variant="outline"
          className="border-amber-300 bg-amber-50 text-amber-700"
        >
          Aguardando agendamento
        </Badge>
      );
    case "upcoming":
      return <Badge variant="secondary">Não iniciada</Badge>;
    case "closed":
      return <Badge variant="destructive">Encerrada</Badge>;
    default:
      return <Badge variant="success">Aberta</Badge>;
  }
}

function pageHref(sp: SearchParams, page: number) {
  const params = new URLSearchParams();
  if (sp.q) params.set("q", sp.q);
  if (sp.zona) params.set("zona", sp.zona);
  if (sp.orgao) params.set("orgao", sp.orgao);
  if (sp.status) params.set("status", sp.status);
  if (sp.sort) params.set("sort", sp.sort);
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

  await requireModule("locais", "VIEW");
  await requirePleito();
  const ano = getSelectedElectionYear(searchParams.ano);
  const anoVigente = getCurrentElectionYear();
  const page = Math.max(1, Number(searchParams.page) || 1);
  const where = buildWhere(searchParams, ano);
  const orderBy = buildOrderBy(searchParams.sort);
  const include = {
    _count: { select: { votes: true, candidates: true } },
  } satisfies Prisma.WorkplaceInclude;
  const tokens = searchTokens(searchParams.q ?? "");

  const total = await prisma.workplace.count({ where: { anoEleicao: ano } });
  const now = new Date();

  let filtered: number;
  let workplaces: Prisma.WorkplaceGetPayload<{ include: typeof include }>[];

  if (tokens.length > 0) {
    // Com busca textual: carrega os locais que passam nos filtros exatos e casa
    // por tokens em memória (universo pequeno por pleito), ranqueando por
    // relevância — o resultado certo aparece mesmo com o teto de página.
    const all = await prisma.workplace.findMany({ where, orderBy, include });
    const ranked = all
      .map((w) => ({
        w,
        score: searchScore(`${w.nome} ${w.orgao} ${w.linkToken}`, tokens),
      }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);
    filtered = ranked.length;
    workplaces = ranked
      .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
      .map((x) => x.w);
  } else if (isLifecycleSort(searchParams.sort)) {
    // Sorts por ciclo de vida: ordena em memória com a semântica correta
    // (universo pequeno por pleito). Passado recente > futuro próximo > sem data.
    const all = await prisma.workplace.findMany({ where, include });
    const sorted = ordenarPorCiclo(all, searchParams.sort, now);
    filtered = sorted.length;
    workplaces = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  } else {
    // Sem busca textual: paginação direta no banco (rápida).
    filtered = await prisma.workplace.count({ where });
    workplaces = await prisma.workplace.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include,
    });
  }

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
        <div className="flex flex-wrap gap-2">
          <ReportGenerator ano={ano} />
          <Button asChild>
            <Link href={`${BASE}/novo?ano=${ano}`}>
              <Plus className="mr-2 h-4 w-4" />
              Cadastrar local
            </Link>
          </Button>
        </div>
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
