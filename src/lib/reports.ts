import type { Prisma, Zona } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/format";
import { votingStatus, type VotingStatus } from "@/lib/voting-status";
import { apurarEleitos, calcularVagas } from "@/lib/vagas";

/** Inclui "undefined" = local sem janela agendada (Aguardando Diretoria). */
export type ApuracaoStatus = VotingStatus;

export type ApuracaoCandidato = {
  nome: string;
  votos: number;
  pct: number;
  eleito: boolean;
  /** Não assume a vaga (renúncia/desistência/desempate). */
  renunciou: boolean;
  /** Eleito PRESERVADO de rodada anterior (não concorreu na suplementar). */
  preservado?: boolean;
};

export type Apuracao = {
  id: string;
  nome: string;
  orgao: string;
  zona: string;
  status: ApuracaoStatus;
  /** Rodada atual do local (1 = normal; 2+ = suplementar). */
  rodadaAtual: number;
  inicioDisplay: string;
  fimDisplay: string;
  /** Timestamps (ms) para ORDENAR por ciclo de vida; null = sem janela. */
  inicioSort: number | null;
  fimSort: number | null;
  totalVotos: number;
  voteLimit: number | null;
  totalCandidatos: number;
  /** Nº de vagas do local (regra de progressão por nº de candidatos). */
  vagas: number;
  /** Candidatos COM votos, ordenados desc, limitados (não lista os sem voto). */
  ranking: ApuracaoCandidato[];
  /** Total de candidatos que receberam ao menos 1 voto. */
  votadosCount: number;
  /** Nomes dos eleitos (definitivos). */
  eleitos: string[];
  /** Nomes empatados na linha de corte (disputando vaga restante). */
  empatados: string[];
  /** Votos de CADA empatado (todos têm o mesmo total). null se não há empate. */
  empatadosVotos: number | null;
  vagasEmDisputa: number;
  temEmpate: boolean;
  /** Candidatos que NÃO assumiram a vaga (suplente promovido). */
  renunciantes: { nome: string; votos: number; motivo: string | null }[];
  /** Vagas sem preenchimento (faltam suplentes com voto). */
  vagasVazias: number;
  /** A diretoria já aceitou as vagas vazias (finalizado sem suplementar)? */
  vagasVaziasAceitas: boolean;
};

export type ReportSummary = {
  totalLocais: number;
  totalVotos: number;
  abertas: number;
  encerradas: number;
  /** Agendadas (início no futuro). NÃO inclui as sem data. */
  naoIniciadas: number;
  /** Sem janela agendada (Aguardando Diretoria). */
  naoDefinidas: number;
  porOrgao: { orgao: string; locais: number; votos: number }[];
  porZona: { zona: string; votos: number }[];
};

export type ReportData = {
  apuracoes: Apuracao[];
  summary: ReportSummary;
  geradoEmDisplay: string;
};

// Máximo de candidatos (com votos) exibidos por local no relatório.
const RANKING_CAP = 100;

function emptyReport(): ReportData {
  return {
    apuracoes: [],
    summary: {
      totalLocais: 0,
      totalVotos: 0,
      abertas: 0,
      encerradas: 0,
      naoIniciadas: 0,
      naoDefinidas: 0,
      porOrgao: [],
      porZona: [],
    },
    geradoEmDisplay: formatDateTime(new Date()),
  };
}

export async function getReportData(opts: {
  anoEleicao: number;
  orgao?: string;
  localId?: string;
  zona?: string;
  somenteEncerradas?: boolean;
}): Promise<ReportData> {
  const now = new Date();

  const where: Prisma.WorkplaceWhereInput = { anoEleicao: opts.anoEleicao };
  if (opts.localId) where.id = opts.localId;
  if (opts.orgao) where.orgao = opts.orgao;
  if (opts.zona) where.zona = opts.zona as Zona;

  // Apenas metadados dos locais (nunca a lista de candidatos).
  const workplaces = await prisma.workplace.findMany({
    where,
    orderBy: [{ orgao: "asc" }, { nome: "asc" }],
    select: {
      id: true,
      nome: true,
      orgao: true,
      zona: true,
      voteLimit: true,
      dataInicioVotacao: true,
      dataFimVotacao: true,
      vagasVaziasAceitas: true,
      rodadaAtual: true,
    },
  });

  let scoped = workplaces.map((w) => ({
    ...w,
    status: votingStatus(w.dataInicioVotacao, w.dataFimVotacao, now),
  }));
  if (opts.somenteEncerradas) {
    scoped = scoped.filter((w) => w.status === "closed");
  }

  const ids = scoped.map((w) => w.id);
  if (ids.length === 0) return emptyReport();

  // Agrupa os locais por rodada atual (normalmente só "1") para filtrar os
  // votos da rodada corrente de cada um — sem SQL bruto, sem N consultas.
  // Em rodada 1 sem eleitos preservados, tudo produz o resultado histórico.
  const idsByRodada = new Map<number, string[]>();
  for (const w of scoped) {
    const arr = idsByRodada.get(w.rodadaAtual) ?? [];
    arr.push(w.id);
    idsByRodada.set(w.rodadaAtual, arr);
  }

  // AGREGAÇÃO no banco: contagem de candidatos por local e votos por
  // (local, candidato). Nada de "dados brutos" de milhares de candidatos.
  // Os votos são contados SÓ da rodada atual do local e SEM eleitos
  // preservados (rodadas anteriores) — que entram travados como eleitos.
  const [candCounts, voteGroupsByRodada, preservadosRaw] = await Promise.all([
    prisma.candidate.groupBy({
      by: ["workplaceId"],
      where: { workplaceId: { in: ids } },
      _count: { workplaceId: true },
    }),
    Promise.all(
      [...idsByRodada.entries()].map(([rodada, rodadaIds]) =>
        prisma.vote.groupBy({
          by: ["workplaceId", "candidateId"],
          where: {
            workplaceId: { in: rodadaIds },
            rodada,
            candidate: { eleitoPreservado: false },
          },
          _count: { candidateId: true },
        }),
      ),
    ),
    prisma.candidate.findMany({
      where: { workplaceId: { in: ids }, eleitoPreservado: true },
      select: { workplaceId: true, nome: true, preservadoVotos: true },
      orderBy: { preservadoVotos: "desc" },
    }),
  ]);
  const voteGroups = voteGroupsByRodada.flat();

  // Eleitos preservados (rodadas anteriores) por local — sempre eleitos.
  const preservadosByLocal = new Map<
    string,
    { nome: string; votos: number }[]
  >();
  for (const p of preservadosRaw) {
    const arr = preservadosByLocal.get(p.workplaceId) ?? [];
    arr.push({ nome: p.nome, votos: p.preservadoVotos ?? 0 });
    preservadosByLocal.set(p.workplaceId, arr);
  }

  const votedIds = [...new Set(voteGroups.map((g) => g.candidateId))];
  const nomes = votedIds.length
    ? await prisma.candidate.findMany({
        where: { id: { in: votedIds } },
        select: { id: true, nome: true, renunciou: true, renunciaMotivo: true },
      })
    : [];
  const metaById = new Map(nomes.map((c) => [c.id, c]));
  const candCountMap = new Map(
    candCounts.map((c) => [c.workplaceId, c._count.workplaceId]),
  );

  // Votos por local (apenas candidatos com voto). Carrega o status de renúncia
  // para a apuração promover o suplente quando alguém não assume a vaga.
  const votadosByLocal = new Map<
    string,
    {
      id: string;
      nome: string;
      votos: number;
      renunciou: boolean;
      renunciaMotivo: string | null;
    }[]
  >();
  for (const g of voteGroups) {
    const m = metaById.get(g.candidateId);
    const arr = votadosByLocal.get(g.workplaceId) ?? [];
    arr.push({
      id: g.candidateId,
      nome: m?.nome ?? "—",
      votos: g._count.candidateId,
      renunciou: m?.renunciou ?? false,
      renunciaMotivo: m?.renunciaMotivo ?? null,
    });
    votadosByLocal.set(g.workplaceId, arr);
  }

  const apuracoes: Apuracao[] = scoped.map((w) => {
    const totalCandidatos = candCountMap.get(w.id) ?? 0;
    const vagas = calcularVagas(totalCandidatos);
    const votados = (votadosByLocal.get(w.id) ?? []).sort(
      (a, b) => b.votos - a.votos || a.nome.localeCompare(b.nome),
    );
    const totalVotos = votados.reduce((s, c) => s + c.votos, 0);

    // Eleitos preservados de rodadas anteriores (suplementar): travados como
    // eleitos, ocupam vagas e reduzem as vagas disputadas na rodada atual.
    const preservados = preservadosByLocal.get(w.id) ?? [];
    const vagasRestantes = Math.max(0, vagas - preservados.length);

    // A apuração da rodada atual disputa APENAS as vagas restantes.
    const resultado = apurarEleitos(votados, vagasRestantes);
    const eleitosSet = new Set(resultado.eleitos.map((c) => c.id));

    // Ranking: preservados no topo (marcados) + candidatos da rodada atual.
    const rankingPreservados: ApuracaoCandidato[] = preservados.map((p) => ({
      nome: p.nome,
      votos: p.votos,
      pct: 0, // votos de outra rodada — não compõem o total da rodada atual.
      eleito: true,
      renunciou: false,
      preservado: true,
    }));
    const rankingAtual: ApuracaoCandidato[] = votados
      .slice(0, RANKING_CAP)
      .map((c) => ({
        nome: c.nome,
        votos: c.votos,
        pct: totalVotos > 0 ? Math.round((c.votos / totalVotos) * 100) : 0,
        eleito: eleitosSet.has(c.id),
        renunciou: c.renunciou,
      }));
    const ranking: ApuracaoCandidato[] = [
      ...rankingPreservados,
      ...rankingAtual,
    ];

    // Eleitos finais = preservados (travados) + eleitos da rodada atual.
    const eleitosNomes = [
      ...preservados.map((p) => p.nome),
      ...resultado.eleitos.map((c) => c.nome),
    ];

    return {
      id: w.id,
      nome: w.nome,
      orgao: w.orgao,
      zona: w.zona,
      status: w.status,
      rodadaAtual: w.rodadaAtual,
      // Sem janela agendada: "—" (não há data para exibir no relatório).
      inicioDisplay: w.dataInicioVotacao
        ? formatDateTime(w.dataInicioVotacao)
        : "—",
      fimDisplay: w.dataFimVotacao ? formatDateTime(w.dataFimVotacao) : "—",
      inicioSort: w.dataInicioVotacao?.getTime() ?? null,
      fimSort: w.dataFimVotacao?.getTime() ?? null,
      totalVotos,
      voteLimit: w.voteLimit,
      totalCandidatos,
      vagas,
      ranking,
      votadosCount: votados.length,
      eleitos: eleitosNomes,
      empatados: resultado.empatados.map((c) => c.nome),
      empatadosVotos: resultado.empatados[0]?.votos ?? null,
      vagasEmDisputa: resultado.vagasEmDisputa,
      temEmpate: resultado.temEmpate,
      renunciantes: resultado.renunciantes.map((c) => ({
        nome: c.nome,
        votos: c.votos,
        motivo: c.renunciaMotivo,
      })),
      vagasVazias: resultado.vagasVazias,
      vagasVaziasAceitas: w.vagasVaziasAceitas,
    };
  });

  // Resumo agregado (a partir dos locais do escopo).
  const porOrgaoMap = new Map<string, { locais: number; votos: number }>();
  const porZonaMap = new Map<string, number>();
  let abertas = 0;
  let encerradas = 0;
  let naoIniciadas = 0;
  let naoDefinidas = 0;
  let totalVotos = 0;

  for (const a of apuracoes) {
    totalVotos += a.totalVotos;
    if (a.status === "open") abertas++;
    else if (a.status === "closed") encerradas++;
    else if (a.status === "upcoming") naoIniciadas++;
    else naoDefinidas++;

    const o = porOrgaoMap.get(a.orgao) ?? { locais: 0, votos: 0 };
    o.locais += 1;
    o.votos += a.totalVotos;
    porOrgaoMap.set(a.orgao, o);
    porZonaMap.set(a.zona, (porZonaMap.get(a.zona) ?? 0) + a.totalVotos);
  }

  const summary: ReportSummary = {
    totalLocais: apuracoes.length,
    totalVotos,
    abertas,
    encerradas,
    naoIniciadas,
    naoDefinidas,
    porOrgao: [...porOrgaoMap.entries()]
      .map(([orgao, v]) => ({ orgao, ...v }))
      .sort((a, b) => b.votos - a.votos),
    porZona: [...porZonaMap.entries()]
      .map(([zona, votos]) => ({ zona, votos }))
      .sort((a, b) => b.votos - a.votos),
  };

  return { apuracoes, summary, geradoEmDisplay: formatDateTime(now) };
}
