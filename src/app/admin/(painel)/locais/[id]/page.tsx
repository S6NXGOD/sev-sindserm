import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ChevronLeft, Vote } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatDateTime, toDateTimeLocalValue } from "@/lib/format";
import { votingStatus } from "@/lib/voting-status";
import { apurarEleitos, calcularVagas } from "@/lib/vagas";
import { getCurrentElectionYear, requirePleito } from "@/lib/election";
import { requireModule } from "@/lib/current-user";
import { RegistroLocal } from "@/components/admin/registro-local";
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
  await requireModule("locais", "VIEW");
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
      rodadaAtual: true,
      semRepresentacao: true,
      semRepresentacaoMotivo: true,
      dataInicioVotacao: true,
      dataFimVotacao: true,
      createdAt: true,
      criadoPorId: true,
      criadoPorNome: true,
      agendadoPorId: true,
      agendadoPorNome: true,
      agendadoEm: true,
      encerradoPorId: true,
      encerradoPorNome: true,
      encerradoEm: true,
    },
  });

  if (!workplace) {
    notFound();
  }

  // Resolve as fotos ATUAIS dos autores das ações (o nome é desnormalizado e
  // sobrevive à exclusão; a foto vem do usuário, se ainda existir).
  const atorIds = [
    workplace.criadoPorId,
    workplace.agendadoPorId,
    workplace.encerradoPorId,
  ].filter((x): x is string => Boolean(x));
  const atores = atorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: atorIds } },
        select: { id: true, fotoUrl: true },
      })
    : [];
  const fotoDe = (uid: string | null) =>
    (uid && atores.find((a) => a.id === uid)?.fotoUrl) || null;

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

  // Rodada ATUAL (suplementar): a apuração conta só os votos desta rodada e os
  // eleitos preservados de rodadas anteriores entram travados. Rodada 1 sem
  // preservados = comportamento idêntico ao histórico.
  const rodada = workplace.rodadaAtual;

  const [
    totalVotes,
    grupos,
    preservadosRaw,
    candTotal,
    candidatesPage,
    votersTotal,
    voters,
  ] = await Promise.all([
    prisma.vote.count({ where: { workplaceId: id, rodada } }),
    // AGREGAÇÃO no banco: votos por candidato da RODADA ATUAL, sem preservados.
    prisma.vote.groupBy({
      by: ["candidateId"],
      where: {
        workplaceId: id,
        rodada,
        candidate: { eleitoPreservado: false },
      },
      _count: { candidateId: true },
      orderBy: { _count: { candidateId: "desc" } },
      take: takeApuracao,
    }),
    // Eleitos preservados (rodadas anteriores) — sempre entram como eleitos.
    prisma.candidate.findMany({
      where: { workplaceId: id, eleitoPreservado: true },
      select: { id: true, nome: true, preservadoVotos: true },
      orderBy: { preservadoVotos: "desc" },
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

  // Eleitos preservados de rodadas anteriores: travados, ocupam vagas e
  // reduzem as vagas disputadas na rodada atual.
  const preservados = preservadosRaw.map((p) => ({
    id: p.id,
    nome: p.nome,
    votos: p.preservadoVotos ?? 0,
  }));
  const vagasRestantes = Math.max(0, vagas - preservados.length);

  // Apuração de eleitos: nº de vagas vem do total real de candidatos.
  // Candidatos que renunciaram são pulados e o suplente é promovido.
  // A rodada atual disputa só as vagas restantes (fora as preservadas).
  const resultado = apurarEleitos(ranked, vagasRestantes);

  // Eleitos finais = preservados (travados) + eleitos da rodada atual.
  const eleitosCombinados = [...preservados, ...resultado.eleitos];

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

    rodadaAtual: workplace.rodadaAtual,
    semRepresentacao: workplace.semRepresentacao,
    semRepresentacaoMotivo: workplace.semRepresentacaoMotivo,
    totalCandidatos,
    vagas,
    eleitos: eleitosCombinados,
    empatados: resultado.empatados,
    vagasEmDisputa: resultado.vagasEmDisputa,
    temEmpate: resultado.temEmpate,
    eleitosIds: eleitosCombinados.map((c) => c.id),
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

      {/* Quem criou / agendou / encerrou este local (foto + nome + horário). */}
      <RegistroLocal
        criado={{
          nome: workplace.criadoPorNome,
          fotoUrl: fotoDe(workplace.criadoPorId),
          em: workplace.createdAt,
        }}
        agendado={{
          nome: workplace.agendadoPorNome,
          fotoUrl: fotoDe(workplace.agendadoPorId),
          em: workplace.agendadoEm,
        }}
        encerrado={{
          nome: workplace.encerradoPorNome,
          fotoUrl: fotoDe(workplace.encerradoPorId),
          em: workplace.encerradoEm,
        }}
      />
    </div>
  );
}
