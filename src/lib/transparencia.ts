import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { calcularVagas } from "@/lib/vagas";
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
  status?: "todos" | "open" | "closed";
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
};

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
  };
  statusPie: { status: string; valor: number }[];
  /** Locais agendados que abrem primeiro (limitado para render). */
  proximasAberturas: ProximaAbertura[];
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
  },
  statusPie: [],
  proximasAberturas: [],
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
  const [locaisRaw, votedCounts] = await Promise.all([
    prisma.workplace.findMany({
      where: { anoEleicao: ano },
      select: {
        id: true,
        nome: true,
        orgao: true,
        zona: true,
        dataInicioVotacao: true,
        dataFimVotacao: true,
        _count: { select: { voters: true, candidates: true } },
      },
      orderBy: { nome: "asc" },
    }),
    prisma.$queryRaw<{ wid: string; n: number }[]>`
      SELECT "workplaceId" AS wid, COUNT(DISTINCT "candidateId")::int AS n
      FROM votes WHERE "anoEleicao" = ${ano}
      GROUP BY "workplaceId"`,
  ]);

  const votedMap = new Map(votedCounts.map((v) => [v.wid, v.n]));

  const todos: TransparenciaLocal[] = locaisRaw.map((w) => ({
    id: w.id,
    nome: w.nome,
    orgao: w.orgao,
    zona: w.zona,
    status: votingStatus(w.dataInicioVotacao, w.dataFimVotacao, now),
    totalVotantes: w._count.voters,
    totalCandidatos: w._count.candidates,
    vagas: calcularVagas(w._count.candidates),
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
  for (const l of todos) {
    votos += l.totalVotantes; // voter 1:1 voto
    vagas += l.vagas;
    if (l.status === "open") abertas += 1;
    else if (l.status === "closed") {
      encerradas += 1;
      eleitos += Math.min(l.vagas, votedMap.get(l.id) ?? 0);
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

  const orgaos = [...new Set(todos.map((l) => l.orgao))].sort((a, b) =>
    a.localeCompare(b),
  );

  // Filtros dinâmicos (texto livre, órgão, status) aplicados em memória.
  const q = (filtros.q ?? "").trim().toLowerCase();
  const locais = todos.filter((l) => {
    if (filtros.orgao && l.orgao !== filtros.orgao) return false;
    if (filtros.status === "open" && l.status !== "open") return false;
    if (filtros.status === "closed" && l.status !== "closed") return false;
    if (
      q &&
      !l.nome.toLowerCase().includes(q) &&
      !l.orgao.toLowerCase().includes(q)
    )
      return false;
    return true;
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
    },
    kpis: {
      locais: todos.length,
      votos,
      eleitos,
      vagas,
      abertas,
      encerradas,
      agendadas: naoIniciadas,
    },
    statusPie: [
      { status: "Aguardando Diretoria", valor: naoDefinidas },
      { status: "Agendadas", valor: naoIniciadas },
      { status: "Em Andamento", valor: abertas },
      { status: "Encerradas", valor: encerradas },
    ],
    proximasAberturas,
    orgaos,
    locais,
  };
}

/* -------------------------------------------------------------------------- */
/*                  Resultado de UM local (eleitos/suplentes)                 */
/* -------------------------------------------------------------------------- */

export type CandidatoResultado = { nome: string; votos: number };
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
  eleitos: CandidatoResultado[];
  suplentes: CandidatoResultado[];
  /** Candidatos sem nenhum voto (não listados, apenas contados). */
  semVotos: number;
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
      dataInicioVotacao: true,
      dataFimVotacao: true,
      _count: { select: { voters: true, candidates: true } },
    },
  });
  if (!wp) return null;

  const totalCandidatos = wp._count.candidates;
  const vagas = calcularVagas(totalCandidatos);

  // Ranking por votos (agregado no banco, ordenado e limitado).
  const grupos = await prisma.vote.groupBy({
    by: ["candidateId"],
    where: { workplaceId },
    _count: { candidateId: true },
    orderBy: { _count: { candidateId: "desc" } },
    take: RESULTADO_CAP,
  });
  const ids = grupos.map((g) => g.candidateId);
  const nomes = ids.length
    ? await prisma.candidate.findMany({
        where: { id: { in: ids } },
        select: { id: true, nome: true },
      })
    : [];
  const nomeById = new Map(nomes.map((c) => [c.id, c.nome]));

  const ranked: CandidatoResultado[] = grupos
    .map((g) => ({
      nome: nomeById.get(g.candidateId) ?? "—",
      votos: g._count.candidateId,
    }))
    .sort((a, b) => b.votos - a.votos || a.nome.localeCompare(b.nome));

  const assentos = Math.min(vagas, ranked.length);
  const eleitos = ranked.slice(0, assentos);
  const suplentes = ranked.slice(assentos);
  const semVotos = Math.max(0, totalCandidatos - ranked.length);

  return {
    id: wp.id,
    nome: wp.nome,
    orgao: wp.orgao,
    zona: wp.zona,
    status: votingStatus(wp.dataInicioVotacao, wp.dataFimVotacao),
    dataInicio: wp.dataInicioVotacao?.toISOString() ?? null,
    dataFim: wp.dataFimVotacao?.toISOString() ?? null,
    vagas,
    totalCandidatos,
    totalVotantes: wp._count.voters,
    eleitos,
    suplentes,
    semVotos,
  };
}

/* -------------------------------------------------------------------------- */
/*                  Relatório geral do pleito (CSV de eleitos)                */
/* -------------------------------------------------------------------------- */

const CSV_CAP = 20000;

/** CSV consolidado: todos os eleitos (locais encerrados) do pleito. */
export async function getEleitosCsv(electionId: string): Promise<{
  filename: string;
  csv: string;
} | null> {
  const election = await prisma.election.findUnique({
    where: { id: electionId },
    select: { ano: true, duracaoMandato: true },
  });
  if (!election) return null;
  const ano = election.ano;
  const now = new Date();

  const [locais, candCounts, votedCounts] = await Promise.all([
    prisma.workplace.findMany({
      where: { anoEleicao: ano },
      select: {
        id: true,
        nome: true,
        orgao: true,
        zona: true,
        dataInicioVotacao: true,
        dataFimVotacao: true,
      },
    }),
    prisma.candidate.groupBy({
      by: ["workplaceId"],
      where: { workplace: { anoEleicao: ano } },
      _count: { workplaceId: true },
    }),
    prisma.$queryRaw<{ wid: string; n: number }[]>`
      SELECT "workplaceId" AS wid, COUNT(DISTINCT "candidateId")::int AS n
      FROM votes WHERE "anoEleicao" = ${ano}
      GROUP BY "workplaceId"`,
  ]);
  const candMap = new Map(
    candCounts.map((c) => [c.workplaceId, c._count.workplaceId]),
  );
  const votedMap = new Map(votedCounts.map((v) => [v.wid, v.n]));

  const fechados = locais.filter(
    (l) => votingStatus(l.dataInicioVotacao, l.dataFimVotacao, now) === "closed",
  );

  // Top por local (apenas encerrados), via janela em SQL filtrada por IDs.
  let ranked: { wid: string; nome: string; votos: number; rn: number }[] = [];
  if (fechados.length > 0) {
    ranked = await prisma.$queryRaw<typeof ranked>(Prisma.sql`
      SELECT wid, nome, votos, rn::int AS rn FROM (
        SELECT v."workplaceId" AS wid, c.nome AS nome, COUNT(*)::int AS votos,
               ROW_NUMBER() OVER (
                 PARTITION BY v."workplaceId" ORDER BY COUNT(*) DESC, c.nome ASC
               ) AS rn
        FROM votes v JOIN candidates c ON c.id = v."candidateId"
        WHERE v."anoEleicao" = ${ano}
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

  const linhas: string[][] = [];
  const metaById = new Map(fechados.map((l) => [l.id, l]));
  for (const l of fechados.sort((a, b) => a.nome.localeCompare(b.nome))) {
    const vagas = calcularVagas(candMap.get(l.id) ?? 0);
    const eleitosCount = Math.min(vagas, votedMap.get(l.id) ?? 0);
    if (eleitosCount <= 0) continue;
    const top = (byLocal.get(l.id) ?? [])
      .sort((a, b) => a.rn - b.rn)
      .slice(0, eleitosCount);
    const meta = metaById.get(l.id)!;
    for (const c of top) {
      if (linhas.length >= CSV_CAP) break;
      linhas.push([
        meta.nome,
        meta.orgao,
        meta.zona,
        c.nome,
        String(c.votos),
      ]);
    }
  }

  const header = ["Local", "Orgao", "Zona", "Eleito", "Votos"];
  const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
  const corpo = [header, ...linhas]
    .map((linha) => linha.map(esc).join(";"))
    .join("\r\n");

  return {
    filename: `eleitos-pleito-${ano}.csv`,
    // BOM para o Excel reconhecer UTF-8.
    csv: `﻿${corpo}`,
  };
}
