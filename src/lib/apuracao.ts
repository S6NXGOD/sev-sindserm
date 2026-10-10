import { prisma } from "@/lib/prisma";
import { apurarEleitos, calcularVagas } from "@/lib/vagas";

// SERVER-ONLY (usa prisma). Apuração compacta de UM local — usada para decidir
// as notificações de "empate ao encerrar" e "vaga vazia ao encerrar".

export type ApuracaoLocal = {
  vagas: number;
  totalVotos: number;
  temEmpate: boolean;
  vagasVazias: number;
  /** Titulares finais = preservados (travados) + eleitos da rodada atual. */
  eleitos: { id: string; nome: string; votos: number }[];
  /** Fila de suplência (ordem de votos): elegíveis não eleitos nem empatados. */
  suplentes: { id: string; nome: string; votos: number }[];
  semVotos: boolean;
};

/**
 * Apura os eleitos de um local (nº de vagas = regra de progressão sobre o total
 * de candidatos). Retorna sinais acionáveis: `temEmpate` e `vagasVazias`.
 */
export async function apurarLocal(workplaceId: string): Promise<ApuracaoLocal> {
  // Rodada ATUAL do local (suplementar). A apuração conta só os votos desta
  // rodada; os eleitos preservados de rodadas anteriores entram travados.
  // Local inexistente cai em rodada 1 (comportamento idêntico ao histórico).
  const wp = await prisma.workplace.findUnique({
    where: { id: workplaceId },
    select: { rodadaAtual: true },
  });
  const rodada = wp?.rodadaAtual ?? 1;

  // O nº de vagas usa o TOTAL de candidatos cadastrados (inclui preservados).
  const totalCandidatos = await prisma.candidate.count({
    where: { workplaceId },
  });
  const vagas = calcularVagas(totalCandidatos);
  // Cobre TODOS os candidatos votados (suplência completa p/ homologação), com teto
  // de segurança. Antes era vagas+30 (min 50), que truncava a fila em locais grandes.
  const takeApuracao = Math.min(Math.max(totalCandidatos, 50), 1000);

  const [totalVotos, grupos, preservadosRaw] = await Promise.all([
    // Comparecimento/votos da RODADA ATUAL.
    prisma.vote.count({ where: { workplaceId, rodada } }),
    // Votos por candidato NA RODADA ATUAL, sem eleitos preservados (que não
    // concorrem na suplementar — já estão eleitos).
    prisma.vote.groupBy({
      by: ["candidateId"],
      where: { workplaceId, rodada, candidate: { eleitoPreservado: false } },
      _count: { candidateId: true },
      orderBy: { _count: { candidateId: "desc" } },
      take: takeApuracao,
    }),
    // Eleitos preservados de rodadas anteriores — sempre entram como eleitos.
    prisma.candidate.findMany({
      where: { workplaceId, eleitoPreservado: true },
      select: { id: true, nome: true, preservadoVotos: true },
      orderBy: { preservadoVotos: "desc" },
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

  // Preservados travam vagas: a rodada atual disputa só as restantes.
  const preservados = preservadosRaw.map((p) => ({
    id: p.id,
    nome: p.nome,
    votos: p.preservadoVotos ?? 0,
  }));
  const vagasRestantes = Math.max(0, vagas - preservados.length);

  const r = apurarEleitos(ranked, vagasRestantes);

  // Suplência = elegíveis da rodada atual que NÃO foram eleitos nem ficaram
  // empatados na linha de corte (mesma definição do portal público), por votos.
  const eleitoIds = new Set(r.eleitos.map((c) => c.id));
  const empateIds = new Set(r.empatados.map((c) => c.id));
  const suplentes = ranked
    .filter((c) => !c.renunciou && !eleitoIds.has(c.id) && !empateIds.has(c.id))
    // Desempate determinístico por nome (igual ao relatório/portal) — a ordem de
    // suplência define a sequência de convocação, não pode variar entre execuções.
    .sort((a, b) => b.votos - a.votos || a.nome.localeCompare(b.nome))
    .map((c) => ({ id: c.id, nome: c.nome, votos: c.votos }));

  return {
    vagas,
    totalVotos,
    temEmpate: r.temEmpate,
    vagasVazias: r.vagasVazias,
    // Eleitos finais = preservados (travados) + eleitos da rodada atual.
    eleitos: [...preservados, ...r.eleitos].map((e) => ({
      id: e.id,
      nome: e.nome,
      votos: e.votos,
    })),
    suplentes,
    semVotos: totalVotos === 0,
  };
}
