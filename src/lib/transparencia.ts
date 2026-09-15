import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { apurarEleitos, calcularVagas } from "@/lib/vagas";
import { votingStatus, type VotingStatus } from "@/lib/voting-status";
import type { ProximaAbertura } from "@/components/proximas-aberturas";
import {
  resolvePleitoLogo,
  resolveSindsermLogo,
  tituloInstitucional,
  trienioLabel,
} from "@/lib/election";

// Módulo server-only (importa Prisma). Componentes "use client" recebem por prop
// ou chamam as Server Actions em lib/actions/transparencia.ts.

// Reexporta o status canônico (inclui "undefined" = ainda não agendada).
export type LocalStatus = VotingStatus;

/* -------------------------------------------------------------------------- */
/*                       Seletor global de pleitos                            */
/* -------------------------------------------------------------------------- */

export type PleitoOption = {
  id: string;
  ano: number;
  label: string;
  isEspecial: boolean;
  ativo: boolean;
};

export async function getPleitosPublicos(): Promise<{
  pleitos: PleitoOption[];
  defaultId: string | null;
}> {
  const elections = await prisma.election.findMany({
    orderBy: [{ ano: "desc" }, { isEleicaoEspecial: "asc" }],
  });
  const pleitos: PleitoOption[] = elections.map((e) => ({
    id: e.id,
    ano: e.ano,
    label:
      tituloInstitucional(e.titulo, e.ano, e.duracaoMandato) +
      (e.isEleicaoEspecial ? " · Especial" : ""),
    isEspecial: e.isEleicaoEspecial,
    ativo: e.status === "ATIVO",
  }));
  // Padrão: pleito mais recente com status ATIVO; senão o mais recente.
  const ativo = elections.find((e) => e.status === "ATIVO");
  const defaultId = (ativo ?? elections[0])?.id ?? null;
  return { pleitos, defaultId };
}

/* -------------------------------------------------------------------------- */
/*                       Dados do portal (por pleito)                         */
/* -------------------------------------------------------------------------- */

export type TransparenciaFiltros = {
  q?: string;
  orgao?: string;
  status?: "todos" | "open" | "closed" | "upcoming" | "suplementar";
};

export type TransparenciaLocal = {
  id: string;
  nome: string;
  orgao: string;
  zona: string;
  status: LocalStatus;
  totalVotantes: number;
  totalCandidatos: number;
  vagas: number;
  /** Rodada de votação atual (1 = normal; 2+ = eleição suplementar). */
  rodadaAtual: number;
  /** null quando a votação ainda não foi agendada (status "undefined"). */
  dataInicio: string | null;
  dataFim: string | null;
};

export type TransparenciaPleito = {
  id: string;
  ano: number;
  titulo: string;
  trienio: string;
  status: string;
  isEspecial: boolean;
  logoSindserm: string;
  logoPleito: string | null;
  emailOficial: string | null;
  /** Parciais por candidato dos locais ABERTOS são públicas neste pleito? */
  parciaisPublicas: boolean;
};

/** Um local com votação em andamento (para o painel "Apuração ao vivo"). */
export type LiderancaAoVivo = {
  id: string;
  nome: string;
  orgao: string;
  zona: string;
  votantes: number;
  vagas: number;
  /**
   * Líderes parciais atuais (os provisoriamente eleitos, até `vagas`) — LIMITADO
   * para prévia (a lista completa é buscada ao expandir). Vazio quando as
   * parciais públicas do pleito estão OFF ou ainda não há votos.
   */
  lideres: { nome: string; votos: number }[];
};

// Quantos líderes trazer na PRÉVIA de cada local aberto (a lista completa vem ao
// expandir). Locais com muitas vagas mostram "+N em disputa".
const LIDERES_PREVIA = 5;

export type TransparenciaData = {
  pleito: TransparenciaPleito | null;
  kpis: {
    locais: number;
    votos: number;
    eleitos: number;
    vagas: number;
    abertas: number;
    encerradas: number;
    /** Agendadas (vão abrir) — alimenta o card "Próximas aberturas". */
    agendadas: number;
    /** Locais em eleição suplementar (rodada 2+). Alimenta o aviso do portal. */
    suplementares: number;
  };
  statusPie: { status: string; valor: number }[];
  /** Locais agendados que abrem primeiro (limitado para render). */
  proximasAberturas: ProximaAbertura[];
  /** Ranking público de PARTICIPAÇÃO (locais que já começaram, por votantes). */
  rankingParticipacao: {
    id: string;
    nome: string;
    orgao: string;
    zona: string;
    votantes: number;
    status: LocalStatus;
  }[];
  /** Votantes por zona (barras de participação). */
  votantesPorZona: { zona: string; votantes: number }[];
  /** Locais com votação EM ANDAMENTO agora (para o painel "Apuração ao vivo"). */
  liderancaAoVivo: LiderancaAoVivo[];
  /** Reconciliação pública (anti-fraude): comparecimento x votos na urna. */
  integridade: { votantes: number; votos: number; confere: boolean };
  orgaos: string[];
  locais: TransparenciaLocal[];
};

/** Quantas "próximas aberturas" listar (as demais ficam só na contagem). */
const PROXIMAS_CAP = 6;

const EMPTY: TransparenciaData = {
  pleito: null,
  kpis: {
    locais: 0,
    votos: 0,
    eleitos: 0,
    vagas: 0,
    abertas: 0,
    encerradas: 0,
    agendadas: 0,
    suplementares: 0,
  },
  statusPie: [],
  proximasAberturas: [],
  rankingParticipacao: [],
  votantesPorZona: [],
  liderancaAoVivo: [],
  integridade: { votantes: 0, votos: 0, confere: true },
  orgaos: [],
  locais: [],
};

export async function getTransparenciaData(
  electionId: string,
  filtros: TransparenciaFiltros = {},
): Promise<TransparenciaData> {
  const election = await prisma.election.findUnique({
    where: { id: electionId },
  });
  if (!election) return EMPTY;

  const ano = election.ano;
  const now = new Date();

  // UMA consulta indexada por ano traz todos os locais com os _count (votantes
  // e candidatos). KPIs vêm do conjunto completo; os cards são filtrados.
  // A contagem de eleitos por local (locais ENCERRADOS) usa COUNT(DISTINCT).
  const [locaisRaw, votedCounts, totalVotosReais, preservadosCounts] =
    await Promise.all([
      prisma.workplace.findMany({
        where: { anoEleicao: ano },
        select: {
          id: true,
          nome: true,
          orgao: true,
          zona: true,
          rodadaAtual: true,
          dataInicioVotacao: true,
          dataFimVotacao: true,
          _count: { select: { voters: true, candidates: true } },
        },
        orderBy: { nome: "asc" },
      }),
      // Votados na RODADA ATUAL que ASSUMEM a vaga (exclui renunciantes e os
      // eleitos preservados, que não concorrem na rodada corrente).
      prisma.$queryRaw<{ wid: string; n: number }[]>`
        SELECT v."workplaceId" AS wid, COUNT(DISTINCT v."candidateId")::int AS n
        FROM votes v
        JOIN candidates c ON c.id = v."candidateId"
        JOIN workplaces w ON w.id = v."workplaceId" AND v."rodada" = w."rodadaAtual"
        WHERE v."anoEleicao" = ${ano} AND c."renunciou" = false
          AND c."eleitoPreservado" = false
        GROUP BY v."workplaceId"`,
      // RECONCILIAÇÃO: total de VOTOS na urna (todas as rodadas) — deve casar com
      // o comparecimento (cada votante registra 1 voto por rodada). Divergência =
      // anomalia auditável.
      prisma.vote.count({ where: { anoEleicao: ano } }),
      // Eleitos preservados (rodadas anteriores) por local — contam como eleitos.
      prisma.candidate.groupBy({
        by: ["workplaceId"],
        where: { workplace: { anoEleicao: ano }, eleitoPreservado: true },
        _count: { workplaceId: true },
      }),
    ]);

  const votedMap = new Map(votedCounts.map((v) => [v.wid, v.n]));
  const preservadosMap = new Map(
    preservadosCounts.map((p) => [p.workplaceId, p._count.workplaceId]),
  );

  const todos: TransparenciaLocal[] = locaisRaw.map((w) => ({
    id: w.id,
    nome: w.nome,
    orgao: w.orgao,
    zona: w.zona,
    status: votingStatus(w.dataInicioVotacao, w.dataFimVotacao, now),
    totalVotantes: w._count.voters,
    totalCandidatos: w._count.candidates,
    vagas: calcularVagas(w._count.candidates),
    rodadaAtual: w.rodadaAtual,
    dataInicio: w.dataInicioVotacao?.toISOString() ?? null,
    dataFim: w.dataFimVotacao?.toISOString() ?? null,
  }));

  // KPIs do pleito inteiro (não filtrado). Os 4 status são exclusivos: locais
  // "não definidos" (sem data) NÃO entram em "não iniciadas".
  let votos = 0;
  let vagas = 0;
  let eleitos = 0;
  let abertas = 0;
  let encerradas = 0;
  let naoIniciadas = 0;
  let naoDefinidas = 0;
  let suplementares = 0;
  for (const l of todos) {
    votos += l.totalVotantes; // voter 1:1 voto
    vagas += l.vagas;
    if (l.rodadaAtual > 1) suplementares += 1;
    if (l.status === "open") abertas += 1;
    else if (l.status === "closed") {
      encerradas += 1;
      // Eleitos = preservados (rodadas anteriores) + eleitos da rodada atual.
      const presv = preservadosMap.get(l.id) ?? 0;
      const restantes = Math.max(0, l.vagas - presv);
      eleitos += presv + Math.min(restantes, votedMap.get(l.id) ?? 0);
    } else if (l.status === "upcoming") naoIniciadas += 1;
    else naoDefinidas += 1;
  }

  // PRÓXIMAS ABERTURAS: agendadas, ordenadas pela que abre primeiro. Derivado do
  // conjunto já carregado (sem consulta extra ao banco).
  const proximasAberturas: ProximaAbertura[] = todos
    .filter(
      (l): l is TransparenciaLocal & { dataInicio: string } =>
        l.status === "upcoming" && l.dataInicio !== null,
    )
    .sort((a, b) => a.dataInicio.localeCompare(b.dataInicio))
    .slice(0, PROXIMAS_CAP)
    .map((l) => ({
      id: l.id,
      nome: l.nome,
      zona: l.zona,
      orgao: l.orgao,
      inicio: l.dataInicio,
    }));

  // RANKING PÚBLICO de participação: só locais que JÁ começaram (open/closed),
  // ordenados por comparecimento. É o "lugar rico em dados" para o filiado.
  const rankingParticipacao = todos
    .filter((l) => l.status === "open" || l.status === "closed")
    .sort(
      (a, b) =>
        b.totalVotantes - a.totalVotantes || a.nome.localeCompare(b.nome),
    )
    .slice(0, 8)
    .map((l) => ({
      id: l.id,
      nome: l.nome,
      orgao: l.orgao,
      zona: l.zona,
      votantes: l.totalVotantes,
      status: l.status,
    }));

  // Participação por zona (votantes = comparecimento; Voter 1:1 voto).
  const zonaMap = new Map<string, number>();
  for (const l of todos) {
    zonaMap.set(l.zona, (zonaMap.get(l.zona) ?? 0) + l.totalVotantes);
  }
  const votantesPorZona = [...zonaMap.entries()]
    .map(([zona, votantes]) => ({ zona, votantes }))
    .sort((a, b) => b.votantes - a.votantes);

  // APURAÇÃO AO VIVO: locais EM ANDAMENTO agora (mais votantes no topo). O líder
  // parcial só é calculado/revelado se a diretoria habilitou `parciaisPublicas`.
  const abertos = todos
    .filter((l) => l.status === "open")
    .sort((a, b) => b.totalVotantes - a.totalVotantes || a.nome.localeCompare(b.nome))
    .slice(0, 12);
  // Prévia dos LÍDERES parciais (top-N por local aberto), só se habilitado. A
  // lista completa é buscada ao expandir o card (getResultadoLocal, gated).
  const lideresMap = new Map<string, { nome: string; votos: number }[]>();
  if (election.parciaisPublicas && abertos.length > 0) {
    const linhas = await prisma.$queryRaw<
      { wid: string; nome: string; votos: number; rn: number }[]
    >(Prisma.sql`
      SELECT wid, nome, votos::int AS votos, rn::int AS rn FROM (
        SELECT v."workplaceId" AS wid, c.nome AS nome, COUNT(*)::int AS votos,
               ROW_NUMBER() OVER (
                 PARTITION BY v."workplaceId" ORDER BY COUNT(*) DESC, c.nome ASC
               ) AS rn
        FROM votes v
        JOIN candidates c ON c.id = v."candidateId"
        JOIN workplaces w ON w.id = v."workplaceId" AND v."rodada" = w."rodadaAtual"
        WHERE v."anoEleicao" = ${ano}
          AND c."renunciou" = false
          AND c."eleitoPreservado" = false
          AND v."workplaceId" IN (${Prisma.join(abertos.map((l) => l.id))})
        GROUP BY v."workplaceId", c.id, c.nome
      ) t WHERE rn <= ${LIDERES_PREVIA}
      ORDER BY wid, rn`);
    for (const l of linhas) {
      const arr = lideresMap.get(l.wid) ?? [];
      arr.push({ nome: l.nome, votos: l.votos });
      lideresMap.set(l.wid, arr);
    }
  }
  const liderancaAoVivo: LiderancaAoVivo[] = abertos.map((l) => ({
    id: l.id,
    nome: l.nome,
    orgao: l.orgao,
    zona: l.zona,
    votantes: l.totalVotantes,
    vagas: l.vagas,
    lideres: lideresMap.get(l.id) ?? [],
  }));

  const orgaos = [...new Set(todos.map((l) => l.orgao))].sort((a, b) =>
    a.localeCompare(b),
  );

  // Filtros dinâmicos (texto livre, órgão, status) aplicados em memória.
  const q = (filtros.q ?? "").trim().toLowerCase();
  const locais = todos.filter((l) => {
    if (filtros.orgao && l.orgao !== filtros.orgao) return false;
    if (filtros.status === "open" && l.status !== "open") return false;
    if (filtros.status === "closed" && l.status !== "closed") return false;
    if (filtros.status === "upcoming" && l.status !== "upcoming") return false;
    if (filtros.status === "suplementar" && l.rodadaAtual <= 1) return false;
    if (
      q &&
      !l.nome.toLowerCase().includes(q) &&
      !l.orgao.toLowerCase().includes(q)
    )
      return false;
    return true;
  });

  // ORDEM POR CICLO DE VIDA (o filiado vê "as eleições rolando" primeiro):
  // 1º as EM ANDAMENTO (mais votantes no topo), 2º as ENCERRADAS recentes,
  // 3º as que vão abrir (mais próximas), 4º as ainda sem agenda (nome). Antes
  // era só alfabético — as centenas de "aguardando" afogavam o que interessa.
  const RANK: Record<LocalStatus, number> = {
    open: 0,
    closed: 1,
    upcoming: 2,
    undefined: 3,
  };
  locais.sort((a, b) => {
    if (RANK[a.status] !== RANK[b.status]) return RANK[a.status] - RANK[b.status];
    switch (a.status) {
      case "open":
        return b.totalVotantes - a.totalVotantes || a.nome.localeCompare(b.nome);
      case "closed": // encerrou mais recentemente primeiro
        return (b.dataFim ?? "").localeCompare(a.dataFim ?? "");
      case "upcoming": // abre mais cedo primeiro
        return (a.dataInicio ?? "").localeCompare(b.dataInicio ?? "");
      default:
        return a.nome.localeCompare(b.nome);
    }
  });

  return {
    pleito: {
      id: election.id,
      ano,
      titulo: tituloInstitucional(election.titulo, ano, election.duracaoMandato),
      trienio: trienioLabel(ano, election.duracaoMandato),
      status: election.status,
      isEspecial: election.isEleicaoEspecial,
      logoSindserm: resolveSindsermLogo(election.logoSindsermUrl),
      logoPleito: resolvePleitoLogo(election.logoPleitoUrl),
      emailOficial: election.emailOficial?.trim() || null,
      parciaisPublicas: election.parciaisPublicas,
    },
    kpis: {
      locais: todos.length,
      votos,
      eleitos,
      vagas,
      abertas,
      encerradas,
      agendadas: naoIniciadas,
      suplementares,
    },
    statusPie: [
      { status: "Aguardando Diretoria", valor: naoDefinidas },
      { status: "Agendadas", valor: naoIniciadas },
      { status: "Em Andamento", valor: abertas },
      { status: "Encerradas", valor: encerradas },
    ],
    proximasAberturas,
    rankingParticipacao,
    votantesPorZona,
    liderancaAoVivo,
    integridade: { votantes: votos, votos: totalVotosReais, confere: votos === totalVotosReais },
    orgaos,
    locais,
  };
}

/* -------------------------------------------------------------------------- */
/*                  Resultado de UM local (eleitos/suplentes)                 */
/* -------------------------------------------------------------------------- */

export type CandidatoResultado = {
  nome: string;
  votos: number;
  /** true = eleito PRESERVADO de uma rodada anterior (não concorreu na atual). */
  preservado?: boolean;
};
export type ResultadoLocal = {
  id: string;
  nome: string;
  orgao: string;
  zona: string;
  status: LocalStatus;
  /** null quando a votação ainda não foi agendada. */
  dataInicio: string | null;
  dataFim: string | null;
  vagas: number;
  totalCandidatos: number;
  totalVotantes: number;
  /** Rodada de votação atual (1 = normal; 2+ = suplementar). */
  rodadaAtual: number;
  /** Reconciliação DESTA rodada: comparecimento x votos (o filiado confere a urna). */
  reconciliacao: { votantes: number; votos: number; confere: boolean };
  eleitos: CandidatoResultado[];
  suplentes: CandidatoResultado[];
  /**
   * Candidatos que NÃO assumiram a vaga (renúncia/desistência/desempate), com o
   * MOTIVO — transparência pública da decisão tomada no pleito.
   */
  renunciantes: { nome: string; votos: number; motivo: string | null }[];
  /**
   * EMPATE na linha de corte (mais elegíveis empatados do que vagas restantes):
   * a(s) vaga(s) aguarda(m) desempate pelo estatuto/assembleia. null = sem empate.
   */
  empate: { votos: number; vagasEmDisputa: number; candidatos: string[] } | null;
  /** Candidatos sem nenhum voto (não listados, apenas contados). */
  semVotos: number;
  /**
   * true quando os números exibidos são uma PARCIAL de votação AINDA ABERTA
   * (apuração ao vivo habilitada pela diretoria). A UI deve rotular como
   * "parcial · pode mudar", não como resultado final.
   */
  parcial: boolean;
};

// Limite de candidatos detalhados por local (anti-quebra no celular/PDF).
const RESULTADO_CAP = 2000;

export async function getResultadoLocal(
  workplaceId: string,
): Promise<ResultadoLocal | null> {
  const wp = await prisma.workplace.findUnique({
    where: { id: workplaceId },
    select: {
      id: true,
      nome: true,
      orgao: true,
      zona: true,
      anoEleicao: true,
      rodadaAtual: true,
      dataInicioVotacao: true,
      dataFimVotacao: true,
      _count: { select: { voters: true, candidates: true } },
    },
  });
  if (!wp) return null;

  const status = votingStatus(wp.dataInicioVotacao, wp.dataFimVotacao);
  const totalCandidatos = wp._count.candidates;
  const vagas = calcularVagas(totalCandidatos);

  // Reconciliação DESTA rodada (participação x votos) — sempre pública.
  const [votantesRodada, votosRodada] = await Promise.all([
    prisma.voter.count({ where: { workplaceId, rodada: wp.rodadaAtual } }),
    prisma.vote.count({ where: { workplaceId, rodada: wp.rodadaAtual } }),
  ]);
  const reconciliacao = {
    votantes: votantesRodada,
    votos: votosRodada,
    confere: votantesRodada === votosRodada,
  };

  // GATE de sigilo: a apuração por candidato só é revelada quando o local está
  // ENCERRADO — OU quando está ABERTO e a diretoria habilitou as parciais
  // públicas do pleito (`parciaisPublicas`). Nos demais casos, devolvemos só o
  // comparecimento (seguro), sem revelar quem lidera.
  let revelar = status === "closed";
  let parcial = false;
  if (status === "open") {
    const el = await prisma.election.findFirst({
      where: { ano: wp.anoEleicao },
      orderBy: [{ isEleicaoEspecial: "asc" }, { createdAt: "asc" }],
      select: { parciaisPublicas: true },
    });
    if (el?.parciaisPublicas) {
      revelar = true;
      parcial = true;
    }
  }

  const baseVazia = {
    id: wp.id,
    nome: wp.nome,
    orgao: wp.orgao,
    zona: wp.zona,
    status,
    dataInicio: wp.dataInicioVotacao?.toISOString() ?? null,
    dataFim: wp.dataFimVotacao?.toISOString() ?? null,
    vagas,
    totalCandidatos,
    totalVotantes: wp._count.voters,
    rodadaAtual: wp.rodadaAtual,
    reconciliacao,
  };
  if (!revelar) {
    return {
      ...baseVazia,
      eleitos: [],
      suplentes: [],
      renunciantes: [],
      empate: null,
      semVotos: 0,
      parcial: false,
    };
  }

  // ELEITOS PRESERVADOS (rodadas anteriores): já travados, não concorrem na
  // rodada atual e ocupam vagas. Em rodada 1 normal, esta lista é vazia.
  const preservadosRaw = await prisma.candidate.findMany({
    where: { workplaceId, eleitoPreservado: true },
    select: { nome: true, preservadoVotos: true },
    orderBy: { preservadoVotos: "desc" },
  });
  const preservados: CandidatoResultado[] = preservadosRaw.map((p) => ({
    nome: p.nome,
    votos: p.preservadoVotos ?? 0,
    preservado: true,
  }));
  const vagasRestantes = Math.max(0, vagas - preservados.length);

  // Ranking por votos DA RODADA ATUAL (agregado no banco, ordenado e limitado).
  const grupos = await prisma.vote.groupBy({
    by: ["candidateId"],
    where: { workplaceId, rodada: wp.rodadaAtual },
    _count: { candidateId: true },
    orderBy: { _count: { candidateId: "desc" } },
    take: RESULTADO_CAP,
  });
  const ids = grupos.map((g) => g.candidateId);
  const nomes = ids.length
    ? await prisma.candidate.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          nome: true,
          renunciou: true,
          renunciaMotivo: true,
          eleitoPreservado: true,
        },
      })
    : [];
  const metaById = new Map(nomes.map((c) => [c.id, c]));

  const ranked = grupos
    // Preservados não concorrem na rodada atual (defensivo — não teriam votos aqui).
    .filter((g) => !metaById.get(g.candidateId)?.eleitoPreservado)
    .map((g) => {
      const m = metaById.get(g.candidateId);
      return {
        nome: m?.nome ?? "—",
        votos: g._count.candidateId,
        renunciou: m?.renunciou ?? false,
        motivo: m?.renunciaMotivo ?? null,
      };
    })
    .sort((a, b) => b.votos - a.votos || a.nome.localeCompare(b.nome));

  // Apuração pela função CANÔNICA (mesma do admin) — portal e painel nunca
  // divergem. Renunciantes saem da fila; empate na linha de corte fica retido
  // (não é decidido por ordem de nome) e é exposto para o portal avisar.
  const elegiveis = ranked.filter((c) => !c.renunciou);
  const r = apurarEleitos(ranked, vagasRestantes);
  const eleitosSet = new Set(r.eleitos);
  const empatadosSet = new Set(r.empatados);

  const eleitosNovos: CandidatoResultado[] = r.eleitos.map((c) => ({
    nome: c.nome,
    votos: c.votos,
  }));
  // Suplentes = elegíveis que não foram eleitos nem estão empatados na linha de corte.
  const suplentes: CandidatoResultado[] = elegiveis
    .filter((c) => !eleitosSet.has(c) && !empatadosSet.has(c))
    .map((c) => ({ nome: c.nome, votos: c.votos }));
  const renunciantes = r.renunciantes.map((c) => ({
    nome: c.nome,
    votos: c.votos,
    motivo: c.motivo,
  }));

  // Empate na linha de corte: transparência pública do que aguarda desempate.
  const empate = r.temEmpate
    ? {
        votos: r.empatados[0]?.votos ?? 0,
        vagasEmDisputa: r.vagasEmDisputa,
        candidatos: r.empatados.map((c) => c.nome),
      }
    : null;

  // Eleitos finais = preservados (travados) + eleitos da rodada atual.
  const eleitos: CandidatoResultado[] = [...preservados, ...eleitosNovos];
  const contados =
    r.eleitos.length + r.empatados.length + suplentes.length + renunciantes.length;
  const semVotos = Math.max(0, totalCandidatos - contados - preservados.length);

  return {
    ...baseVazia,
    eleitos,
    suplentes,
    renunciantes,
    empate,
    semVotos,
    parcial,
  };
}

/* -------------------------------------------------------------------------- */
/*                 Linha do tempo pública + histórico por rodada              */
/* -------------------------------------------------------------------------- */

export type TimelineEvento = {
  tipo: string;
  titulo: string;
  detalhe: string | null;
  autorNome: string | null;
  rodada: number;
  data: string; // ISO
};

export type RodadaArquivada = {
  rodada: number;
  encerradaEm: string; // ISO
  vagas: number;
  votantes: number;
  votos: number;
  confere: boolean;
  eleitos: { nome: string; votos: number; preservado?: boolean }[];
};

export type LinhaTempoLocal = {
  nome: string;
  rodadaAtual: number;
  eventos: TimelineEvento[];
  rodadasArquivadas: RodadaArquivada[];
};

/**
 * LINHA DO TEMPO PÚBLICA de um local: cada passo oficial (agendamento, abertura,
 * encerramento, reabertura, suplementar com MOTIVO, renúncias) mais o HISTÓRICO
 * de resultado de cada rodada já encerrada (snapshot arquivado). Só dados
 * públicos (sem PII). Para locais anteriores a este recurso, deriva os marcos
 * básicos dos campos do próprio local (cadastro/agendamento/encerramento).
 */
export async function getLinhaTempoLocal(
  workplaceId: string,
): Promise<LinhaTempoLocal | null> {
  const wp = await prisma.workplace.findUnique({
    where: { id: workplaceId },
    select: {
      nome: true,
      rodadaAtual: true,
      createdAt: true,
      agendadoEm: true,
      agendadoPorNome: true,
      encerradoEm: true,
      encerradoPorNome: true,
      dataInicioVotacao: true,
      dataFimVotacao: true,
    },
  });
  if (!wp) return null;

  const registros = await prisma.localEvento.findMany({
    where: { workplaceId },
    orderBy: { createdAt: "asc" },
  });

  const temTipoLogado = (t: string) => registros.some((r) => r.tipo === t);
  const eventos: TimelineEvento[] = [];

  // Marco fixo: cadastro (sempre derivado — o createdAt do local nunca é sobrescrito).
  eventos.push({
    tipo: "CADASTRO",
    titulo: "Local cadastrado no sistema",
    detalhe: null,
    autorNome: null,
    rodada: 1,
    data: wp.createdAt.toISOString(),
  });

  // Marcos derivados (só p/ locais SEM eventos logados do tipo — retrocompat).
  if (wp.agendadoEm && !temTipoLogado("AGENDAMENTO")) {
    eventos.push({
      tipo: "AGENDAMENTO",
      titulo: "Votação agendada",
      detalhe:
        wp.dataInicioVotacao && wp.dataFimVotacao
          ? `De ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(wp.dataInicioVotacao)} até ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(wp.dataFimVotacao)}.`
          : null,
      autorNome: wp.agendadoPorNome,
      rodada: 1,
      data: wp.agendadoEm.toISOString(),
    });
  }
  const encerradoDerivavel =
    wp.encerradoEm &&
    !temTipoLogado("ENCERRAMENTO") &&
    votingStatus(wp.dataInicioVotacao, wp.dataFimVotacao) === "closed";
  if (encerradoDerivavel && wp.encerradoEm) {
    eventos.push({
      tipo: "ENCERRAMENTO",
      titulo: "Votação encerrada",
      detalhe: null,
      autorNome: wp.encerradoPorNome,
      rodada: 1,
      data: wp.encerradoEm.toISOString(),
    });
  }

  // Eventos logados (append-only): a fonte de verdade dos passos ricos.
  const rodadasArquivadas: RodadaArquivada[] = [];
  for (const r of registros) {
    eventos.push({
      tipo: r.tipo,
      titulo: r.titulo,
      detalhe: r.detalhe,
      autorNome: r.autorNome,
      rodada: r.rodada,
      data: r.createdAt.toISOString(),
    });
    if (r.tipo === "RODADA_ENCERRADA" && r.snapshot) {
      const s = r.snapshot as {
        vagas?: number;
        votantes?: number;
        votos?: number;
        confere?: boolean;
        eleitos?: { nome: string; votos: number; preservado?: boolean }[];
      };
      rodadasArquivadas.push({
        rodada: r.rodada,
        encerradaEm: r.createdAt.toISOString(),
        vagas: s.vagas ?? 0,
        votantes: s.votantes ?? 0,
        votos: s.votos ?? 0,
        confere: s.confere ?? true,
        eleitos: s.eleitos ?? [],
      });
    }
  }

  // Mais recentes primeiro (o filiado acompanha o "agora"); arquivadas por rodada.
  eventos.sort((a, b) => b.data.localeCompare(a.data));
  rodadasArquivadas.sort((a, b) => a.rodada - b.rodada);

  return {
    nome: wp.nome,
    rodadaAtual: wp.rodadaAtual,
    eventos,
    rodadasArquivadas,
  };
}

/* -------------------------------------------------------------------------- */
/*                  Relatório geral do pleito (CSV de eleitos)                */
/* -------------------------------------------------------------------------- */

const CSV_CAP = 20000;

/** CSV consolidado: todos os eleitos (locais encerrados) do pleito. */
export type EleitoRow = {
  local: string;
  orgao: string;
  zona: string;
  eleito: string;
  votos: number;
};

/**
 * Linhas ESTRUTURADAS do relatório geral de eleitos (locais ENCERRADOS, apenas
 * titulares por vaga). Base única para o CSV e para o PDF do Portal.
 */
export async function getEleitosRows(
  electionId: string,
): Promise<{ ano: number; rows: EleitoRow[] } | null> {
  const election = await prisma.election.findUnique({
    where: { id: electionId },
    select: { ano: true, duracaoMandato: true },
  });
  if (!election) return null;
  const ano = election.ano;
  const now = new Date();

  const [locais, candCounts, votedCounts, preservadosRaw] = await Promise.all([
    prisma.workplace.findMany({
      where: { anoEleicao: ano },
      select: {
        id: true,
        nome: true,
        orgao: true,
        zona: true,
        rodadaAtual: true,
        dataInicioVotacao: true,
        dataFimVotacao: true,
      },
    }),
    prisma.candidate.groupBy({
      by: ["workplaceId"],
      where: { workplace: { anoEleicao: ano } },
      _count: { workplaceId: true },
    }),
    // Votados na RODADA ATUAL de cada local (join p/ comparar v.rodada = w.rodadaAtual),
    // excluindo renunciantes e eleitos preservados (que não concorrem na rodada).
    prisma.$queryRaw<{ wid: string; n: number }[]>`
      SELECT v."workplaceId" AS wid, COUNT(DISTINCT v."candidateId")::int AS n
      FROM votes v
      JOIN candidates c ON c.id = v."candidateId"
      JOIN workplaces w ON w.id = v."workplaceId" AND v."rodada" = w."rodadaAtual"
      WHERE v."anoEleicao" = ${ano} AND c."renunciou" = false
        AND c."eleitoPreservado" = false
      GROUP BY v."workplaceId"`,
    // Eleitos preservados (rodadas anteriores) — sempre entram como eleitos.
    prisma.candidate.findMany({
      where: { workplace: { anoEleicao: ano }, eleitoPreservado: true },
      select: { workplaceId: true, nome: true, preservadoVotos: true },
      orderBy: { preservadoVotos: "desc" },
    }),
  ]);
  const candMap = new Map(
    candCounts.map((c) => [c.workplaceId, c._count.workplaceId]),
  );
  const votedMap = new Map(votedCounts.map((v) => [v.wid, v.n]));
  const preservadosByLocal = new Map<
    string,
    { nome: string; votos: number }[]
  >();
  for (const p of preservadosRaw) {
    const arr = preservadosByLocal.get(p.workplaceId) ?? [];
    arr.push({ nome: p.nome, votos: p.preservadoVotos ?? 0 });
    preservadosByLocal.set(p.workplaceId, arr);
  }

  const fechados = locais.filter(
    (l) => votingStatus(l.dataInicioVotacao, l.dataFimVotacao, now) === "closed",
  );

  // Top por local (apenas encerrados) DA RODADA ATUAL, via janela em SQL.
  let ranked: { wid: string; nome: string; votos: number; rn: number }[] = [];
  if (fechados.length > 0) {
    ranked = await prisma.$queryRaw<typeof ranked>(Prisma.sql`
      SELECT wid, nome, votos, rn::int AS rn FROM (
        SELECT v."workplaceId" AS wid, c.nome AS nome, COUNT(*)::int AS votos,
               ROW_NUMBER() OVER (
                 PARTITION BY v."workplaceId" ORDER BY COUNT(*) DESC, c.nome ASC
               ) AS rn
        FROM votes v
        JOIN candidates c ON c.id = v."candidateId"
        JOIN workplaces w ON w.id = v."workplaceId" AND v."rodada" = w."rodadaAtual"
        WHERE v."anoEleicao" = ${ano}
          AND c."renunciou" = false
          AND c."eleitoPreservado" = false
          AND v."workplaceId" IN (${Prisma.join(fechados.map((l) => l.id))})
        GROUP BY v."workplaceId", c.id, c.nome
      ) t`);
  }
  const byLocal = new Map<string, typeof ranked>();
  for (const r of ranked) {
    const arr = byLocal.get(r.wid) ?? [];
    arr.push(r);
    byLocal.set(r.wid, arr);
  }

  const rows: EleitoRow[] = [];
  const metaById = new Map(fechados.map((l) => [l.id, l]));
  for (const l of fechados.sort((a, b) => a.nome.localeCompare(b.nome))) {
    const vagas = calcularVagas(candMap.get(l.id) ?? 0);
    const meta = metaById.get(l.id)!;
    const preservados = preservadosByLocal.get(l.id) ?? [];
    const vagasRestantes = Math.max(0, vagas - preservados.length);
    const eleitosNovosCount = Math.min(vagasRestantes, votedMap.get(l.id) ?? 0);
    const novos = (byLocal.get(l.id) ?? [])
      .sort((a, b) => a.rn - b.rn)
      .slice(0, eleitosNovosCount)
      .map((c) => ({ nome: c.nome, votos: c.votos }));
    // Eleitos = preservados (rodadas anteriores) + eleitos da rodada atual.
    for (const c of [...preservados, ...novos]) {
      if (rows.length >= CSV_CAP) break;
      rows.push({
        local: meta.nome,
        orgao: meta.orgao,
        zona: meta.zona,
        eleito: c.nome,
        votos: c.votos,
      });
    }
  }

  return { ano, rows };
}

export async function getEleitosCsv(electionId: string): Promise<{
  filename: string;
  csv: string;
} | null> {
  const data = await getEleitosRows(electionId);
  if (!data) return null;

  const header = ["Local", "Orgao", "Zona", "Eleito", "Votos"];
  const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
  const corpo = [
    header,
    ...data.rows.map((r) => [r.local, r.orgao, r.zona, r.eleito, String(r.votos)]),
  ]
    .map((linha) => linha.map(esc).join(";"))
    .join("\r\n");

  return {
    filename: `eleitos-pleito-${data.ano}.csv`,
    // BOM para o Excel reconhecer UTF-8.
    csv: `﻿${corpo}`,
  };
}

/* -------------------------------------------------------------------------- */
/*            Relatório PERSONALIZADO do filiado (dados públicos)             */
/* -------------------------------------------------------------------------- */

/**
 * Dataset completo e PÚBLICO para o filiado montar seu relatório em PDF. Contém
 * SOMENTE dados de interesse coletivo (agregados + resultado eleitoral) — nunca
 * PII (LGPD): sem CPF/matrícula/telefone/e-mail e sem vínculo voto↔pessoa.
 */
export type RelatorioTransparencia = {
  pleito: {
    ano: number;
    titulo: string;
    trienio: string;
    logoSindserm: string;
    logoPleito: string | null;
    /** Canal oficial para contestação/atas (rodapé "como contestar"). */
    emailOficial: string | null;
  };
  geradoEm: string;
  kpis: {
    locais: number;
    votantes: number;
    votos: number;
    eleitos: number;
    vagas: number;
    abertas: number;
    encerradas: number;
    agendadas: number;
    /** Locais em eleição suplementar (rodada 2+). */
    suplementares: number;
  };
  integridade: { votantes: number; votos: number; confere: boolean };
  porZona: { zona: string; votantes: number }[];
  porOrgao: { orgao: string; votantes: number }[];
  eleitos: EleitoRow[];
};

export async function getRelatorioTransparencia(
  electionId: string,
): Promise<RelatorioTransparencia | null> {
  const data = await getTransparenciaData(electionId);
  if (!data.pleito) return null;
  const eleitosData = await getEleitosRows(electionId);
  const ano = data.pleito.ano;

  // Participação por ÓRGÃO (agregado — comparecimento por órgão).
  const orgRows = await prisma.$queryRaw<{ orgao: string; n: number }[]>`
    SELECT w."orgao" AS orgao, COUNT(vt.id)::int AS n
    FROM workplaces w LEFT JOIN voters vt ON vt."workplaceId" = w.id
    WHERE w."anoEleicao" = ${ano}
    GROUP BY w."orgao"
    HAVING COUNT(vt.id) > 0
    ORDER BY COUNT(vt.id) DESC`;

  return {
    pleito: {
      ano,
      titulo: data.pleito.titulo,
      trienio: data.pleito.trienio,
      logoSindserm: data.pleito.logoSindserm,
      logoPleito: data.pleito.logoPleito,
      emailOficial: data.pleito.emailOficial,
    },
    geradoEm: new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Sao_Paulo",
    }).format(new Date()),
    kpis: {
      locais: data.kpis.locais,
      votantes: data.kpis.votos,
      votos: data.integridade.votos,
      eleitos: data.kpis.eleitos,
      vagas: data.kpis.vagas,
      abertas: data.kpis.abertas,
      encerradas: data.kpis.encerradas,
      agendadas: data.kpis.agendadas,
      suplementares: data.kpis.suplementares,
    },
    integridade: data.integridade,
    porZona: data.votantesPorZona,
    porOrgao: orgRows.map((o) => ({ orgao: o.orgao, votantes: o.n })),
    eleitos: eleitosData?.rows ?? [],
  };
}
