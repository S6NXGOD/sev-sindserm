import { prisma } from "@/lib/prisma";
import { apurarEleitos, calcularVagas } from "@/lib/vagas";

// SERVER-ONLY (usa prisma). Apuração compacta de UM local — usada para decidir
// as notificações de "empate ao encerrar" e "vaga vazia ao encerrar".

export type ApuracaoLocal = {
  vagas: number;
  totalVotos: number;
  temEmpate: boolean;
  vagasVazias: number;
  eleitos: { id: string; nome: string; votos: number }[];
  semVotos: boolean;
};

/**
 * Apura os eleitos de um local (nº de vagas = regra de progressão sobre o total
 * de candidatos). Retorna sinais acionáveis: `temEmpate` e `vagasVazias`.
 */
export async function apurarLocal(workplaceId: string): Promise<ApuracaoLocal> {
  const totalCandidatos = await prisma.candidate.count({
    where: { workplaceId },
  });
  const vagas = calcularVagas(totalCandidatos);
  const takeApuracao = Math.min(Math.max(vagas + 30, 50), 500);

  const [totalVotos, grupos] = await Promise.all([
    prisma.vote.count({ where: { workplaceId } }),
    prisma.vote.groupBy({
      by: ["candidateId"],
      where: { workplaceId },
      _count: { candidateId: true },
      orderBy: { _count: { candidateId: "desc" } },
      take: takeApuracao,
    }),
  ]);

  const ids = grupos.map((g) => g.candidateId);
  const meta = ids.length
    ? await prisma.candidate.findMany({
        where: { id: { in: ids } },
        select: { id: true, nome: true, renunciou: true },
      })
    : [];
  const metaById = new Map(meta.map((c) => [c.id, c]));

  const ranked = grupos.map((g) => ({
    id: g.candidateId,
    nome: metaById.get(g.candidateId)?.nome ?? "—",
    votos: g._count.candidateId,
    renunciou: metaById.get(g.candidateId)?.renunciou ?? false,
  }));

  const r = apurarEleitos(ranked, vagas);
  return {
    vagas,
    totalVotos,
    temEmpate: r.temEmpate,
    vagasVazias: r.vagasVazias,
    eleitos: r.eleitos.map((e) => ({ id: e.id, nome: e.nome, votos: e.votos })),
    semVotos: totalVotos === 0,
  };
}
