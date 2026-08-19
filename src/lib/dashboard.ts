import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { calcularVagas } from "@/lib/vagas";
import { votingStatus, type VotingStatus } from "@/lib/voting-status";
import type { ProximaAbertura } from "@/components/proximas-aberturas";

/** Quantas "próximas aberturas" listar (as demais ficam só na contagem). */
const PROXIMAS_CAP = 6;

export type RankItem = { rotulo: string; votos: number };
export type StatusFatia = { status: string; valor: number };
export type RitmoPonto = { hora: string; votos: number };
export type LocalAdesao = {
  id: string;
  nome: string;
  zona: string;
  votos: number;
};

/** Local de trabalho com baixa adesão (poucos votos) — painel estratégico. */
export type LowTurnoutLocal = {
  id: string;
  nome: string;
  zona: string;
  orgao: string;
  /** Votos válidos registrados no local (no pleito do ano). */
  votos: number;
  /**
   * Limite de votos do local (Workplace.voteLimit). É o ÚNICO denominador
   * disponível no schema — NÃO existe "total de eleitores cadastrados" por
   * local. null = local sem limite (ilimitado).
   */
  limite: number | null;
  /** Adesão = votos/limite (0–100), só quando há limite definido; senão null. */
  adesaoPct: number | null;
};

export type DashboardData = {
  ano: number;
  kpis: {
    locais: number;
    abertas: number;
    encerradas: number;
    /** Agendadas: início no FUTURO (já tem data, ainda não abriu). */
    naoIniciadas: number;
    /** Aguardando Diretoria: SEM datas (null) — ainda não foi agendada. */
    naoDefinidas: number;
    votos: number;
    candidatos: number;
    /** Soma das vagas de TODOS os locais (regra de progressão por candidatos). */
    vagas: number;
    /** Vagas preenchidas = candidatos com votos, limitado às vagas de cada local. */
    vagasPreenchidas: number;
    votosUltimaHora: number;
  };
  statusPie: StatusFatia[];
  /** Locais com votação AGENDADA, os que abrem primeiro (limitado p/ render). */
  proximasAberturas: ProximaAbertura[];
  ritmoHoje: RitmoPonto[];
  zonasAtivas: RankItem[];
  top3: LocalAdesao[];
  bottom3: LocalAdesao[];
  alertas: {
    semCandidatos: { id: string; nome: string }[];
    lotados: { id: string; nome: string; voteLimit: number }[];
    encerrandoEm24h: { id: string; nome: string; fim: Date }[];
  };
  geradoEm: string;
  /** Próximo encerramento (ISO) entre os locais abertos — para refresh automático. */
  proximoEncerramento: string | null;
};

export type LiderancaLocal = {
  id: string;
  nome: string;
  zona: string;
  totalCandidatos: number;
  vagas: number;
  totalVotos: number;
  liderando: { nome: string; votos: number }[];
};

type RitmoRaw = { hora: number; votos: number };
type LowTurnoutRaw = {
  id: string;
  nome: string;
  zona: string;
  orgao: string;
  votos: number;
  limite: number | null;
};
type EleitoRaw = { wid: string; cid: string; nome: string; votos: number };
type VotedRaw = { wid: string; n: number };
type EleitoRankedRaw = { wid: string; nome: string; votos: number; rn: number };

/** Servidor matematicamente eleito (em local ENCERRADO) — para o Mural. */
export type MuralEleito = {
  nome: string;
  local: string;
  orgao: string;
  votos: number;
};
export type MuralOrgao = { orgao: string; eleitos: number };
export type MuralData = {
  /** Lista detalhada (nomes), por recência de encerramento — limitada p/ render. */
  eleitos: MuralEleito[];
  /** Total REAL de eleitos (mesmo quando a lista detalhada é limitada). */
  totalEleitos: number;
  /** Soma das vagas de TODOS os locais do pleito. */
  vagasTotais: number;
  /** Eleitos agrupados por órgão (layout em colunas para volumes grandes). */
  porOrgao: MuralOrgao[];
  /** Últimos eleitos (para o ticker de rodapé). */
  ultimos: MuralEleito[];
};

export type PresentationLider = { nome: string; votos: number };
export type PresentationLocal = {
  id: string;
  nome: string;
  zona: string;
  /** "undefined" = local ainda sem janela agendada (Aguardando Diretoria). */
  status: VotingStatus;
  totalCandidatos: number;
  vagas: number;
  totalVotos: number;
  /** Quantos candidatos de fato se elegem (min(vagas, candidatos com voto)). */
  eleitosCount: number;
  /** Top 5 candidatos por votos (para o pódio/lista do modal). */
  top: PresentationLider[];
};

const TZ = "America/Sao_Paulo";

function horaBrasil(d: Date): number {
  return Number(
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: TZ,
      hour: "2-digit",
      hour12: false,
    }).format(d),
  );
}

function inicioDoDiaUtc(now: Date): Date {
  // Meia-noite de hoje no horário de Brasília (UTC-3) como instante absoluto.
  const dataBr = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(now);
  return new Date(`${dataBr}T00:00:00-03:00`);
}

export async function getDashboardData(
  anoEleicao: number,
): Promise<DashboardData> {
  const now = new Date();
  const em24h = new Date(now.getTime() + 1000 * 60 * 60 * 24);
  const umaHoraAtras = new Date(now.getTime() - 1000 * 60 * 60);
  const inicioHoje = inicioDoDiaUtc(now);

  const [
    totalLocais,
    totalVotos,
    totalCandidatos,
    abertas,
    encerradas,
    naoIniciadas,
    naoDefinidas,
    votosUltimaHora,
    votosPorLocal,
    ritmoRows,
    locaisLite,
    semCandidatos,
    locaisComLimite,
    encerrandoEm24h,
    proximoFim,
    proximasRaw,
  ] = await Promise.all([
    prisma.workplace.count({ where: { anoEleicao } }),
    prisma.vote.count({ where: { anoEleicao } }),
    prisma.candidate.count({ where: { workplace: { anoEleicao } } }),
    // ATIVAS (votando agora). Datas null nunca casam com lte/gte no SQL,
    // então locais "Não definidos" ficam naturalmente de fora — como deve ser.
    prisma.workplace.count({
      where: {
        anoEleicao,
        dataInicioVotacao: { lte: now },
        dataFimVotacao: { gte: now },
      },
    }),
    // ENCERRADAS: fim no passado.
    prisma.workplace.count({
      where: { anoEleicao, dataFimVotacao: { lt: now } },
    }),
    // NÃO INICIADAS (agendadas): início no FUTURO. Só entram locais que JÁ têm
    // data — os sem data caem em "naoDefinidas", nunca aqui.
    prisma.workplace.count({
      where: { anoEleicao, dataInicioVotacao: { gt: now } },
    }),
    // NÃO DEFINIDAS (Aguardando Diretoria): sem janela agendada.
    prisma.workplace.count({
      where: { anoEleicao, dataInicioVotacao: null },
    }),
    // Votos/Hora: comparecimentos (Voter) nos últimos 60 min — Vote não tem
    // timestamp (sigilo), então usamos Voter.createdAt (relação 1:1 com o voto).
    prisma.voter.count({
      where: { anoEleicao, createdAt: { gte: umaHoraAtras } },
    }),
    prisma.vote.groupBy({
      by: ["workplaceId"],
      where: { anoEleicao },
      _count: { workplaceId: true },
    }),
    // Ritmo de hoje: votos por hora (Brasília), via Voter.createdAt.
    prisma.$queryRaw<RitmoRaw[]>`
      SELECT EXTRACT(HOUR FROM (("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${TZ}))::int AS hora,
             COUNT(*)::int AS votos
      FROM voters
      WHERE "anoEleicao" = ${anoEleicao} AND "createdAt" >= ${inicioHoje}
      GROUP BY 1 ORDER BY 1`,
    // Metadados de todos os locais do ano (para zonas e ranking de adesão).
    prisma.workplace.findMany({
      where: { anoEleicao },
      select: { id: true, nome: true, zona: true },
    }),
    prisma.workplace.findMany({
      where: { anoEleicao, candidates: { none: {} } },
      select: { id: true, nome: true },
      take: 50,
    }),
    prisma.workplace.findMany({
      where: { anoEleicao, voteLimit: { not: null } },
      select: { id: true, nome: true, voteLimit: true },
    }),
    prisma.workplace.findMany({
      where: {
        anoEleicao,
        dataInicioVotacao: { lte: now },
        dataFimVotacao: { gte: now, lte: em24h },
      },
      orderBy: { dataFimVotacao: "asc" },
      select: { id: true, nome: true, dataFimVotacao: true },
      take: 50,
    }),
    // Próximo encerramento entre os locais ABERTOS (para o refresh automático).
    prisma.workplace.findFirst({
      where: {
        anoEleicao,
        dataInicioVotacao: { lte: now },
        dataFimVotacao: { gt: now },
      },
      orderBy: { dataFimVotacao: "asc" },
      select: { dataFimVotacao: true },
    }),
    // PRÓXIMAS ABERTURAS: agendadas (início no futuro), as que abrem primeiro.
    // Locais sem data (null) nunca casam com `gt` — ficam de fora, como deve ser.
    prisma.workplace.findMany({
      where: { anoEleicao, dataInicioVotacao: { gt: now } },
      orderBy: { dataInicioVotacao: "asc" },
      take: PROXIMAS_CAP,
      select: {
        id: true,
        nome: true,
        zona: true,
        orgao: true,
        dataInicioVotacao: true,
      },
    }),
  ]);

  // O `where` garante dataInicioVotacao não-nula; o flatMap só estreita o tipo.
  const proximasAberturas: ProximaAbertura[] = proximasRaw.flatMap((w) =>
    w.dataInicioVotacao
      ? [
          {
            id: w.id,
            nome: w.nome,
            zona: w.zona,
            orgao: w.orgao,
            inicio: w.dataInicioVotacao.toISOString(),
          },
        ]
      : [],
  );

  const countByLocal = new Map(
    votosPorLocal.map((g) => [g.workplaceId, g._count.workplaceId]),
  );

  // Adesão por local (inclui locais com 0 votos).
  const adesao: LocalAdesao[] = locaisLite.map((w) => ({
    id: w.id,
    nome: w.nome,
    zona: w.zona,
    votos: countByLocal.get(w.id) ?? 0,
  }));
  // Ranking de adesão SEM sobreposição: o "menor adesão" exclui os locais que
  // já aparecem no "maior adesão" (com poucos locais, eles se repetiriam).
  const ordenadoDesc = [...adesao].sort((a, b) => b.votos - a.votos);
  const top3 = ordenadoDesc.slice(0, 3);
  const topIds = new Set(top3.map((l) => l.id));
  const bottom3 = ordenadoDesc
    .filter((l) => !topIds.has(l.id))
    .slice(-3)
    .reverse(); // menor adesão primeiro

  // Votos por zona.
  const votosZona = new Map<string, number>();
  for (const w of adesao) {
    votosZona.set(w.zona, (votosZona.get(w.zona) ?? 0) + w.votos);
  }
  const zonasAtivas: RankItem[] = [...votosZona.entries()]
    .map(([rotulo, votos]) => ({ rotulo, votos }))
    .sort((a, b) => b.votos - a.votos);

  // Série de ritmo: da primeira hora com votos até a hora atual (Brasília).
  const ritmoMap = new Map(ritmoRows.map((r) => [r.hora, r.votos]));
  const horaAtual = horaBrasil(now);
  const primeiraHora = ritmoRows.length
    ? Math.min(...ritmoRows.map((r) => r.hora))
    : horaAtual;
  const ritmoHoje: RitmoPonto[] = [];
  for (let h = Math.min(primeiraHora, horaAtual); h <= horaAtual; h++) {
    ritmoHoje.push({
      hora: `${String(h).padStart(2, "0")}h`,
      votos: ritmoMap.get(h) ?? 0,
    });
  }

  const lotados = locaisComLimite
    .filter((w) => {
      const votos = countByLocal.get(w.id) ?? 0;
      return w.voteLimit !== null && votos >= w.voteLimit;
    })
    .map((w) => ({ id: w.id, nome: w.nome, voteLimit: w.voteLimit as number }));

  // Representação: vagas totais do pleito e vagas efetivamente preenchidas
  // (candidatos que já receberam votos, limitado às vagas de cada local).
  const [candPorLocal, votadosPorLocal] = await Promise.all([
    prisma.candidate.groupBy({
      by: ["workplaceId"],
      where: { workplace: { anoEleicao } },
      _count: { workplaceId: true },
    }),
    // Candidatos votados que ASSUMEM a vaga (exclui renunciantes) — assim a
    // "vaga preenchida" reflete a apuração real (renúncia com vaga vazia conta
    // a menos, promoção normal mantém o número).
    prisma.$queryRaw<{ wid: string; n: number }[]>`
      SELECT v."workplaceId" AS wid, COUNT(DISTINCT v."candidateId")::int AS n
      FROM votes v JOIN candidates c ON c.id = v."candidateId"
      WHERE v."anoEleicao" = ${anoEleicao} AND c."renunciou" = false
      GROUP BY v."workplaceId"`,
  ]);
  const votadosMap = new Map(votadosPorLocal.map((r) => [r.wid, Number(r.n)]));
  let vagasTotais = 0;
  let vagasPreenchidas = 0;
  for (const c of candPorLocal) {
    const vagasLocal = calcularVagas(c._count.workplaceId);
    vagasTotais += vagasLocal;
    vagasPreenchidas += Math.min(vagasLocal, votadosMap.get(c.workplaceId) ?? 0);
  }

  return {
    ano: anoEleicao,
    kpis: {
      locais: totalLocais,
      abertas,
      encerradas,
      naoIniciadas,
      naoDefinidas,
      votos: totalVotos,
      candidatos: totalCandidatos,
      vagas: vagasTotais,
      vagasPreenchidas,
      votosUltimaHora,
    },
    // As 4 fatias somam o total de locais (categorias mutuamente exclusivas).
    statusPie: [
      { status: "Aguardando Diretoria", valor: naoDefinidas },
      { status: "Agendadas", valor: naoIniciadas },
      { status: "Em Andamento", valor: abertas },
      { status: "Encerrados", valor: encerradas },
    ],
    proximasAberturas,
    ritmoHoje,
    zonasAtivas,
    top3,
    bottom3,
    alertas: {
      semCandidatos,
      // Limita a exibição (escala: pode haver centenas de locais lotados).
      lotados: lotados.slice(0, 50),
      // O `where` já exige dataFimVotacao entre agora e +24h (null nunca casa);
      // o filtro abaixo só estreita o tipo (Date | null -> Date).
      encerrandoEm24h: encerrandoEm24h.flatMap((w) =>
        w.dataFimVotacao
          ? [{ id: w.id, nome: w.nome, fim: w.dataFimVotacao }]
          : [],
      ),
    },
    geradoEm: new Intl.DateTimeFormat("pt-BR", {
      timeStyle: "medium",
      timeZone: TZ,
    }).format(now),
    proximoEncerramento: proximoFim?.dataFimVotacao?.toISOString() ?? null,
  };
}

/**
 * Locais de trabalho com MENOR adesão (menos votos) do pleito do ano.
 *
 * Decisões de modelagem:
 * - Só considera locais cuja votação JÁ COMEÇOU (`dataInicioVotacao <= agora`).
 *   Locais "não iniciados" têm 0 votos por definição — incluí-los encheria o
 *   ranking de falsos "piores". Locais ABERTOS e ENCERRADOS entram.
 * - INCLUI locais com 0 votos (LEFT JOIN): eles são, justamente, os de menor
 *   adesão. Um `groupBy` em `votes` os deixaria de fora.
 * - LIMIT aplicado no BANCO (`ORDER BY votos ASC ... LIMIT n`): traz só os
 *   piores, nunca centenas de linhas para a dashboard.
 * - Porcentagem: o schema NÃO tem "total de eleitores" por local; o único
 *   denominador existente é `voteLimit` (teto esperado de votos). Quando ele
 *   existe, devolvemos `adesaoPct = votos/limite`; senão, só o nº absoluto.
 */
export async function getLowTurnoutLocations(
  anoEleicao: number,
  limit = 5,
): Promise<LowTurnoutLocal[]> {
  const now = new Date();
  // Trava de segurança: nunca deixar a dashboard pedir um volume enorme.
  const take = Math.min(Math.max(Math.trunc(limit) || 5, 1), 20);

  const rows = await prisma.$queryRaw<LowTurnoutRaw[]>(Prisma.sql`
    SELECT w.id, w.nome, w.zona, w.orgao,
           w."voteLimit" AS limite,
           COUNT(v.id)::int AS votos
    FROM workplaces w
    LEFT JOIN votes v
      ON v."workplaceId" = w.id AND v."anoEleicao" = ${anoEleicao}
    WHERE w."anoEleicao" = ${anoEleicao}
      AND w."dataInicioVotacao" <= ${now}
    GROUP BY w.id
    ORDER BY votos ASC, w.nome ASC
    LIMIT ${take}
  `);

  return rows.map((r) => {
    const votos = Number(r.votos);
    return {
      id: r.id,
      nome: r.nome,
      zona: r.zona,
      orgao: r.orgao,
      votos,
      limite: r.limite,
      adesaoPct:
        r.limite && r.limite > 0
          ? Math.round((votos / r.limite) * 100)
          : null,
    } satisfies LowTurnoutLocal;
  });
}

export type RitmoRange =
  | "1h"
  | "12h"
  | "hoje"
  | "ontem"
  | "7d"
  | "mes"
  | "custom";

function ritmoBounds(
  range: RitmoRange,
  now: Date,
  customInicio?: string,
  customFim?: string,
): { start: Date; end: Date; bucket: "hour" | "day" } {
  const H = 3_600_000;
  const D = 24 * H;
  switch (range) {
    case "1h":
      return { start: new Date(now.getTime() - H), end: now, bucket: "hour" };
    case "12h":
      return { start: new Date(now.getTime() - 12 * H), end: now, bucket: "hour" };
    case "ontem": {
      const ini = inicioDoDiaUtc(now);
      return { start: new Date(ini.getTime() - D), end: ini, bucket: "hour" };
    }
    case "7d":
      return { start: new Date(now.getTime() - 7 * D), end: now, bucket: "day" };
    case "mes":
      return { start: new Date(now.getTime() - 30 * D), end: now, bucket: "day" };
    case "custom": {
      const s = customInicio ? new Date(customInicio) : new Date(now.getTime() - D);
      const e = customFim ? new Date(customFim) : now;
      const spanDias = (e.getTime() - s.getTime()) / D;
      return { start: s, end: e, bucket: spanDias > 2 ? "day" : "hour" };
    }
    case "hoje":
    default:
      return { start: inicioDoDiaUtc(now), end: now, bucket: "hour" };
  }
}

/**
 * Série do "ritmo da votação" para um intervalo selecionável (hoje, última 1h/
 * 12h, ontem, 7 dias, mês, personalizado). Agrega por HORA (intervalos curtos)
 * ou por DIA (intervalos longos), sempre no fuso de Brasília — em SQL, sem
 * percorrer os votantes no Node (escalável).
 */
export async function getRitmoSeries(
  anoEleicao: number,
  range: RitmoRange,
  customInicio?: string,
  customFim?: string,
): Promise<RitmoPonto[]> {
  const now = new Date();
  const { start, end, bucket } = ritmoBounds(range, now, customInicio, customFim);
  if (!(start.getTime() < end.getTime())) return [];

  const fmt =
    bucket === "day"
      ? "DD/MM"
      : range === "custom"
        ? 'DD/MM HH24"h"'
        : 'HH24"h"';

  const rows = await prisma.$queryRaw<{ label: string; votos: number }[]>(
    Prisma.sql`
      SELECT to_char((("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${TZ}), ${fmt}) AS label,
             date_trunc(${bucket}, (("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${TZ})) AS ord,
             COUNT(*)::int AS votos
      FROM voters
      WHERE "anoEleicao" = ${anoEleicao}
        AND "createdAt" >= ${start} AND "createdAt" < ${end}
      GROUP BY 1, 2
      ORDER BY 2`,
  );

  return rows.map((r) => ({ hora: r.label, votos: Number(r.votos) }));
}

/**
 * Liderança parcial dos locais que estão com a votação ACONTECENDO agora.
 * Calcula vagas (regra de corte) e lista os candidatos que se elegeriam neste
 * momento (top por votos). Escalável: window function em SQL, sem percorrer
 * todos os candidatos no Node.
 */
export async function getLiderancaParcial(
  anoEleicao: number,
  limit = 18,
): Promise<LiderancaLocal[]> {
  const now = new Date();
  const abertos = await prisma.workplace.findMany({
    where: {
      anoEleicao,
      dataInicioVotacao: { lte: now },
      dataFimVotacao: { gte: now },
    },
    select: { id: true, nome: true, zona: true },
    take: limit,
  });
  const ids = abertos.map((w) => w.id);
  if (ids.length === 0) return [];

  const [candCounts, ranked] = await Promise.all([
    prisma.candidate.groupBy({
      by: ["workplaceId"],
      where: { workplaceId: { in: ids } },
      _count: { workplaceId: true },
    }),
    prisma.$queryRaw<EleitoRaw[]>`
      SELECT wid, cid, nome, votos FROM (
        SELECT v."workplaceId" AS wid, c.id AS cid, c.nome AS nome,
               COUNT(*)::int AS votos,
               ROW_NUMBER() OVER (
                 PARTITION BY v."workplaceId" ORDER BY COUNT(*) DESC, c.nome ASC
               ) AS rn
        FROM votes v
        JOIN candidates c ON c.id = v."candidateId"
        WHERE v."anoEleicao" = ${anoEleicao}
          AND c."renunciou" = false
          AND v."workplaceId" IN (${Prisma.join(ids)})
        GROUP BY v."workplaceId", c.id, c.nome
      ) t WHERE rn <= 60`,
  ]);

  const candCountMap = new Map(
    candCounts.map((c) => [c.workplaceId, c._count.workplaceId]),
  );
  const rankedByLocal = new Map<string, { nome: string; votos: number }[]>();
  for (const r of ranked) {
    const arr = rankedByLocal.get(r.wid) ?? [];
    arr.push({ nome: r.nome, votos: r.votos });
    rankedByLocal.set(r.wid, arr);
  }

  return abertos
    .map((w) => {
      const totalCandidatos = candCountMap.get(w.id) ?? 0;
      const vagas = calcularVagas(totalCandidatos);
      const arr = (rankedByLocal.get(w.id) ?? []).sort(
        (a, b) => b.votos - a.votos,
      );
      const totalVotos = arr.reduce((s, c) => s + c.votos, 0);
      return {
        id: w.id,
        nome: w.nome,
        zona: w.zona,
        totalCandidatos,
        vagas,
        totalVotos,
        liderando: arr.filter((c) => c.votos > 0).slice(0, vagas),
      };
    })
    .sort((a, b) => b.totalVotos - a.totalVotos);
}

/**
 * Dados de TODOS os locais para o Modo Apresentação (telão): status, vagas,
 * top 5 por votos e nº de eleitos. Usado para a lista com auto-scroll, a
 * detecção de encerramento e o pódio do modal de comemoração.
 */
export async function getPresentationData(
  anoEleicao: number,
): Promise<PresentationLocal[]> {
  const now = new Date();

  const [locais, votosPorLocal, candCounts, top5, votedCounts] =
    await Promise.all([
      prisma.workplace.findMany({
        where: { anoEleicao },
        select: {
          id: true,
          nome: true,
          zona: true,
          dataInicioVotacao: true,
          dataFimVotacao: true,
        },
      }),
      prisma.vote.groupBy({
        by: ["workplaceId"],
        where: { anoEleicao },
        _count: { workplaceId: true },
      }),
      prisma.candidate.groupBy({
        by: ["workplaceId"],
        where: { workplace: { anoEleicao } },
        _count: { workplaceId: true },
      }),
      // Pódio (top 5) e contagem de eleitos: só candidatos que ASSUMEM a vaga
      // (exclui renunciantes) — o telão mostra os vencedores reais.
      prisma.$queryRaw<EleitoRaw[]>`
        SELECT wid, cid, nome, votos FROM (
          SELECT v."workplaceId" AS wid, c.id AS cid, c.nome AS nome,
                 COUNT(*)::int AS votos,
                 ROW_NUMBER() OVER (
                   PARTITION BY v."workplaceId" ORDER BY COUNT(*) DESC, c.nome ASC
                 ) AS rn
          FROM votes v
          JOIN candidates c ON c.id = v."candidateId"
          WHERE v."anoEleicao" = ${anoEleicao} AND c."renunciou" = false
          GROUP BY v."workplaceId", c.id, c.nome
        ) t WHERE rn <= 5`,
      prisma.$queryRaw<VotedRaw[]>`
        SELECT v."workplaceId" AS wid, COUNT(DISTINCT v."candidateId")::int AS n
        FROM votes v JOIN candidates c ON c.id = v."candidateId"
        WHERE v."anoEleicao" = ${anoEleicao} AND c."renunciou" = false
        GROUP BY v."workplaceId"`,
    ]);

  const votosMap = new Map(
    votosPorLocal.map((g) => [g.workplaceId, g._count.workplaceId]),
  );
  const candMap = new Map(
    candCounts.map((c) => [c.workplaceId, c._count.workplaceId]),
  );
  const votedMap = new Map(votedCounts.map((v) => [v.wid, v.n]));
  const topMap = new Map<string, PresentationLider[]>();
  for (const r of top5) {
    const arr = topMap.get(r.wid) ?? [];
    arr.push({ nome: r.nome, votos: r.votos });
    topMap.set(r.wid, arr);
  }

  return locais
    .map((w) => {
      const totalCandidatos = candMap.get(w.id) ?? 0;
      const vagas = calcularVagas(totalCandidatos);
      const votedCount = votedMap.get(w.id) ?? 0;
      const status = votingStatus(w.dataInicioVotacao, w.dataFimVotacao, now);
      const top = (topMap.get(w.id) ?? []).sort((a, b) => b.votos - a.votos);
      return {
        id: w.id,
        nome: w.nome,
        zona: w.zona,
        status,
        totalCandidatos,
        vagas,
        totalVotos: votosMap.get(w.id) ?? 0,
        eleitosCount: Math.min(vagas, votedCount),
        top,
      } satisfies PresentationLocal;
    })
    .sort((a, b) => b.totalVotos - a.totalVotos);
}

// Limites de renderização do Mural (telão liga por horas → DOM/memória controlados).
const MURAL_RN_POR_LOCAL = 150; // nomes por local (locais massivos têm o restante contado, não listado)
const MURAL_DETALHE_MAX = 600; // total de nomes detalhados exibidos

/**
 * "Mural dos Eleitos": servidores JÁ matematicamente eleitos = top `vagas` por
 * votos nos locais ENCERRADOS (resultado final). Retorna a lista detalhada
 * (limitada para o telão não travar), o total real, a soma de vagas do pleito e
 * a contagem por órgão (layout em colunas para volumes massivos).
 */
export async function getMuralEleitos(
  anoEleicao: number,
): Promise<MuralData> {
  const now = new Date();

  const [locais, candCounts, votedCounts] = await Promise.all([
    prisma.workplace.findMany({
      where: { anoEleicao },
      select: {
        id: true,
        nome: true,
        orgao: true,
        dataInicioVotacao: true,
        dataFimVotacao: true,
      },
    }),
    prisma.candidate.groupBy({
      by: ["workplaceId"],
      where: { workplace: { anoEleicao } },
      _count: { workplaceId: true },
    }),
    // Eleitos que ASSUMEM a vaga (exclui renunciantes) — alinha o Mural à
    // apuração real: renúncia com vaga vazia conta a menos.
    prisma.$queryRaw<VotedRaw[]>`
      SELECT v."workplaceId" AS wid, COUNT(DISTINCT v."candidateId")::int AS n
      FROM votes v JOIN candidates c ON c.id = v."candidateId"
      WHERE v."anoEleicao" = ${anoEleicao} AND c."renunciou" = false
      GROUP BY v."workplaceId"`,
  ]);

  const candMap = new Map(
    candCounts.map((c) => [c.workplaceId, c._count.workplaceId]),
  );
  const votedMap = new Map(votedCounts.map((v) => [v.wid, v.n]));

  // Vagas totais do pleito (todos os locais).
  let vagasTotais = 0;
  for (const l of locais) vagasTotais += calcularVagas(candMap.get(l.id) ?? 0);

  // Locais encerrados (filtro em JS — o Prisma trata Date/timestamp de forma
  // consistente; comparar data em $queryRaw cru sofre com fuso), dos mais
  // recentes para os mais antigos (recência do ticker). Locais sem janela
  // agendada (datas null) nunca são "encerrados".
  const fechados = locais
    .filter(
      (l): l is (typeof locais)[number] & { dataFimVotacao: Date } =>
        votingStatus(l.dataInicioVotacao, l.dataFimVotacao, now) === "closed",
    )
    .sort((a, b) => b.dataFimVotacao.getTime() - a.dataFimVotacao.getTime());

  // Top candidatos por local, restrito aos locais ENCERRADOS (por IDs, não por
  // data na SQL). rn::int evita BigInt no cliente.
  let ranked: EleitoRankedRaw[] = [];
  if (fechados.length > 0) {
    ranked = await prisma.$queryRaw<EleitoRankedRaw[]>(Prisma.sql`
      SELECT wid, nome, votos, rn::int AS rn FROM (
        SELECT v."workplaceId" AS wid, c.nome AS nome, COUNT(*)::int AS votos,
               ROW_NUMBER() OVER (
                 PARTITION BY v."workplaceId" ORDER BY COUNT(*) DESC, c.nome ASC
               ) AS rn
        FROM votes v
        JOIN candidates c ON c.id = v."candidateId"
        WHERE v."anoEleicao" = ${anoEleicao}
          AND c."renunciou" = false
          AND v."workplaceId" IN (${Prisma.join(fechados.map((l) => l.id))})
        GROUP BY v."workplaceId", c.id, c.nome
      ) t WHERE rn <= ${MURAL_RN_POR_LOCAL}`);
  }

  const byLocal = new Map<string, EleitoRankedRaw[]>();
  for (const r of ranked) {
    const arr = byLocal.get(r.wid) ?? [];
    arr.push(r);
    byLocal.set(r.wid, arr);
  }

  let totalEleitos = 0;
  const orgaoCount = new Map<string, number>();
  const eleitos: MuralEleito[] = [];

  for (const l of fechados) {
    const vagas = calcularVagas(candMap.get(l.id) ?? 0);
    const eleitosCount = Math.min(vagas, votedMap.get(l.id) ?? 0);
    if (eleitosCount <= 0) continue;
    totalEleitos += eleitosCount;
    orgaoCount.set(l.orgao, (orgaoCount.get(l.orgao) ?? 0) + eleitosCount);

    const top = (byLocal.get(l.id) ?? [])
      .sort((a, b) => a.rn - b.rn)
      .slice(0, eleitosCount);
    for (const c of top) {
      if (eleitos.length < MURAL_DETALHE_MAX) {
        eleitos.push({
          nome: c.nome,
          local: l.nome,
          orgao: l.orgao,
          votos: c.votos,
        });
      }
    }
  }

  const porOrgao = [...orgaoCount.entries()]
    .map(([orgao, e]) => ({ orgao, eleitos: e }))
    .sort((a, b) => b.eleitos - a.eleitos);

  return {
    eleitos,
    totalEleitos,
    vagasTotais,
    porOrgao,
    ultimos: eleitos.slice(0, 30),
  };
}
