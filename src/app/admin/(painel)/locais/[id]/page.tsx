import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ChevronLeft, Vote } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatDateTime, toDateTimeLocalValue } from "@/lib/format";
import { votingStatus } from "@/lib/voting-status";
import { apurarEleitos, calcularVagas } from "@/lib/vagas";
import { getCurrentElectionYear, requirePleito } from "@/lib/election";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  WorkplaceManager,
  type ManagerData,
} from "@/components/admin/workplace-manager";

export const dynamic = "force-dynamic";

const CAND_PAGE_SIZE = 50;
const RANKING_SIZE = 20;

/** Datas null viram string vazia (input datetime-local em branco) / "—". */
const paraInput = (d: Date | null) => (d ? toDateTimeLocalValue(d) : "");
const paraTexto = (d: Date | null) => (d ? formatDateTime(d) : "—");

export default async function LocalDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { cq?: string; cpage?: string };
}) {
  await requirePleito();
  const id = params.id;
  const h = headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const votingBaseUrl = `${proto}://${host}`;

  const workplace = await prisma.workplace.findUnique({
    where: { id },
    select: {
      id: true,
      nome: true,
      orgao: true,
      zona: true,
      linkToken: true,
      anoEleicao: true,
      voteLimit: true,
      dataInicioVotacao: true,
      dataFimVotacao: true,
    },
  });

  if (!workplace) {
    notFound();
  }

  const candQuery = (searchParams.cq ?? "").trim();
  const candPage = Math.max(1, Number(searchParams.cpage) || 1);
  const candWhere = {
    workplaceId: id,
    ...(candQuery
      ? { nome: { contains: candQuery, mode: "insensitive" as const } }
      : {}),
  };

  // Total de candidatos define o nº de vagas (regra de progressão).
  const totalCandidatos = await prisma.candidate.count({
    where: { workplaceId: id },
  });
  const vagas = calcularVagas(totalCandidatos);
  // Quantos candidatos buscar na agregação para apurar eleitos com folga.
  const takeApuracao = Math.min(Math.max(vagas + 30, 50), 500);

  const [totalVotes, grupos, candTotal, candidatesPage, votersTotal, voters] =
    await Promise.all([
      prisma.vote.count({ where: { workplaceId: id } }),
      // AGREGAÇÃO no banco: contagem de votos por candidato, já ordenada.
      prisma.vote.groupBy({
        by: ["candidateId"],
        where: { workplaceId: id },
        _count: { candidateId: true },
        orderBy: { _count: { candidateId: "desc" } },
        take: takeApuracao,
      }),
      prisma.candidate.count({ where: candWhere }),
      prisma.candidate.findMany({
        where: candWhere,
        orderBy: { nome: "asc" },
        skip: (candPage - 1) * CAND_PAGE_SIZE,
        take: CAND_PAGE_SIZE,
        include: { _count: { select: { votes: true } } },
      }),
      prisma.voter.count({ where: { workplaceId: id } }),
      prisma.voter.findMany({
        where: { workplaceId: id },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: { id: true, nome: true, createdAt: true },
      }),
    ]);

  // Nomes + status de renúncia dos candidatos que receberam votos.
  const idsComVotos = grupos.map((g) => g.candidateId);
  const nomes = idsComVotos.length
    ? await prisma.candidate.findMany({
        where: { id: { in: idsComVotos } },
        select: { id: true, nome: true, renunciou: true, renunciaMotivo: true },
      })
    : [];
  const metaById = new Map(nomes.map((c) => [c.id, c]));

  const ranked = grupos.map((g) => {
    const m = metaById.get(g.candidateId);
    return {
      id: g.candidateId,
      nome: m?.nome ?? "—",
      votos: g._count.candidateId,
      renunciou: m?.renunciou ?? false,
      renunciaMotivo: m?.renunciaMotivo ?? null,
    };
  });

  // Apuração de eleitos: nº de vagas vem do total real de candidatos.
  // Candidatos que renunciaram são pulados e o suplente é promovido.
  const resultado = apurarEleitos(ranked, vagas);

  const ranking = ranked.slice(0, RANKING_SIZE).map((c) => ({
    id: c.id,
    nome: c.nome,
    votos: c.votos,
    pct: totalVotes > 0 ? Math.round((c.votos / totalVotes) * 100) : 0,
    renunciou: c.renunciou,
    renunciaMotivo: c.renunciaMotivo,
  }));

  const data: ManagerData = {
    id: workplace.id,
    nome: workplace.nome,
    orgao: workplace.orgao,
    zona: workplace.zona,
    slug: workplace.linkToken,
    status: votingStatus(
      workplace.dataInicioVotacao,
      workplace.dataFimVotacao,
    ),
    inicioLocal: paraInput(workplace.dataInicioVotacao),
    fimLocal: paraInput(workplace.dataFimVotacao),
    inicioDisplay: paraTexto(workplace.dataInicioVotacao),
    fimDisplay: paraTexto(workplace.dataFimVotacao),
    totalVotes,
    voteLimit: workplace.voteLimit,
    publicUrl: `${votingBaseUrl}/votacao/${workplace.linkToken}`,

    totalCandidatos,
    vagas,
    eleitos: resultado.eleitos,
    empatados: resultado.empatados,
    vagasEmDisputa: resultado.vagasEmDisputa,
    temEmpate: resultado.temEmpate,
    eleitosIds: resultado.eleitos.map((c) => c.id),
    // Quem não assume a vaga (renúncia/desistência/desempate) + vagas vazias.
    renunciantes: resultado.renunciantes.map((c) => ({
      id: c.id,
      nome: c.nome,
      votos: c.votos,
      motivo: c.renunciaMotivo,
    })),
    vagasVazias: resultado.vagasVazias,
    ranking,

    candidates: candidatesPage.map((c) => ({
      id: c.id,
      nome: c.nome,
      votes: c._count.votes,
    })),
    candTotal,
    candPage,
    candPageSize: CAND_PAGE_SIZE,
    candQuery,

    voters: voters.map((v) => ({
      id: v.id,
      nome: v.nome,
      horario: formatDateTime(v.createdAt),
    })),
    votersTotal,
  };

  const anoVigente = getCurrentElectionYear();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/locais">
            <ChevronLeft className="mr-1 h-4 w-4" />
            Voltar para a lista
          </Link>
        </Button>
        {/* Vínculo visual: a qual pleito (ano) este local pertence. */}
        <Badge variant="secondary" className="gap-1.5">
          <Vote className="h-3.5 w-3.5" />
          Vínculo: Pleito {workplace.anoEleicao}
          {workplace.anoEleicao !== anoVigente ? " (histórico)" : ""}
        </Badge>
      </div>

      <WorkplaceManager data={data} />
    </div>
  );
}
