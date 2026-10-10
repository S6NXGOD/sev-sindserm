import { prisma } from "@/lib/prisma";
import { getReportData } from "@/lib/reports";
import type { MandatoView, MotivoSaida, SituacaoMandato, PapelMandato } from "@/lib/mandato-constants";

// Reexporta as constantes/tipos client-safe (fonte única em mandato-constants).
export * from "@/lib/mandato-constants";

const SELECT = {
  id: true,
  workplaceId: true,
  nome: true,
  papel: true,
  ordem: true,
  votosHomologados: true,
  situacao: true,
  posseEm: true,
  saidaEm: true,
  saidaMotivo: true,
  assumiuEm: true,
  substituiuNome: true,
  observacao: true,
  workplace: { select: { nome: true, orgao: true, zona: true } },
} as const;

/** Mandato + info do local, para a visão admin. */
export type MandatoLinha = MandatoView & {
  orgao: string;
  zona: string;
  localNome: string;
};

/** Local encerrado, sem empate, com eleitos e AINDA NÃO homologado. */
export type AptoLocal = {
  workplaceId: string;
  nome: string;
  orgao: string;
  zona: string;
  eleitos: number;
  suplentes: number;
};

export type RepresentantesData = {
  mandatos: MandatoLinha[];
  aptos: AptoLocal[];
  locaisHomologados: number;
};

function linhaFrom(m: {
  id: string;
  workplaceId: string;
  nome: string;
  papel: string;
  ordem: number;
  votosHomologados: number;
  situacao: string;
  posseEm: Date | null;
  saidaEm: Date | null;
  saidaMotivo: string | null;
  assumiuEm: Date | null;
  substituiuNome: string | null;
  observacao: string | null;
  workplace: { nome: string; orgao: string; zona: string };
}): MandatoLinha {
  return {
    id: m.id,
    workplaceId: m.workplaceId,
    nome: m.nome,
    papel: m.papel as PapelMandato,
    ordem: m.ordem,
    votosHomologados: m.votosHomologados,
    situacao: m.situacao as SituacaoMandato,
    posseEm: m.posseEm,
    saidaEm: m.saidaEm,
    saidaMotivo: (m.saidaMotivo as MotivoSaida | null) ?? null,
    assumiuEm: m.assumiuEm,
    substituiuNome: m.substituiuNome,
    observacao: m.observacao,
    orgao: m.workplace.orgao,
    zona: m.workplace.zona,
    localNome: m.workplace.nome,
  };
}

/**
 * Dados da tela "Gestão de Representantes" (admin): todos os mandatos do ano +
 * os locais APTOS a homologar (encerrados, sem empate, com eleitos e ainda não
 * materializados). Reaproveita getReportData — a apuração nunca diverge.
 */
export async function getRepresentantesData(
  ano: number,
): Promise<RepresentantesData> {
  const [rows, report] = await Promise.all([
    prisma.mandato.findMany({
      where: { anoEleicao: ano },
      orderBy: [{ ordem: "asc" }],
      select: SELECT,
    }),
    getReportData({ anoEleicao: ano, somenteEncerradas: true }),
  ]);

  const mandatos = rows.map(linhaFrom);
  const homologados = new Set(rows.map((m) => m.workplaceId));

  const aptos: AptoLocal[] = report.apuracoes
    .filter(
      (a) =>
        a.status === "closed" &&
        !a.temEmpate &&
        !a.semRepresentacao &&
        a.eleitos.length > 0 &&
        !homologados.has(a.id),
    )
    .map((a) => ({
      workplaceId: a.id,
      nome: a.nome,
      orgao: a.orgao,
      zona: a.zona,
      eleitos: a.eleitos.length,
      suplentes: a.ranking.filter(
        (c) =>
          !c.eleito &&
          !c.preservado &&
          !c.renunciou &&
          !a.empatados.includes(c.nome),
      ).length,
    }));

  return { mandatos, aptos, locaisHomologados: homologados.size };
}

/* --------------------------- Portal público ------------------------------ */

export type RepresentantePublico = {
  id: string;
  nome: string;
  orgao: string;
  zona: string;
  localNome: string;
  papel: PapelMandato;
  situacao: SituacaoMandato;
  votos: number;
  substituiuNome: string | null;
  assumiuEm: Date | null;
  saidaMotivo: MotivoSaida | null;
  saidaEm: Date | null;
};

export type RepresentantesPublicos = {
  temMandatos: boolean;
  /** Em exercício ou afastados (o mandato vigente do triênio). */
  vigentes: RepresentantePublico[];
  /** Sucessões já ocorridas (titulares que saíram), para transparência. */
  sucessoes: RepresentantePublico[];
};

const SELECT_PUB = {
  id: true,
  nome: true,
  papel: true,
  situacao: true,
  votosHomologados: true,
  substituiuNome: true,
  assumiuEm: true,
  saidaMotivo: true,
  saidaEm: true,
  workplace: { select: { nome: true, orgao: true, zona: true } },
} as const;

function pubFrom(m: {
  id: string;
  nome: string;
  papel: string;
  situacao: string;
  votosHomologados: number;
  substituiuNome: string | null;
  assumiuEm: Date | null;
  saidaMotivo: string | null;
  saidaEm: Date | null;
  workplace: { nome: string; orgao: string; zona: string };
}): RepresentantePublico {
  return {
    id: m.id,
    nome: m.nome,
    orgao: m.workplace.orgao,
    zona: m.workplace.zona,
    localNome: m.workplace.nome,
    papel: m.papel as PapelMandato,
    situacao: m.situacao as SituacaoMandato,
    votos: m.votosHomologados,
    substituiuNome: m.substituiuNome,
    assumiuEm: m.assumiuEm,
    saidaMotivo: (m.saidaMotivo as MotivoSaida | null) ?? null,
    saidaEm: m.saidaEm,
  };
}

/**
 * Representantes do triênio para o PORTAL público. Mostra o MANDATO VIGENTE
 * (em exercício + afastados) e as sucessões ocorridas. Só tem conteúdo depois
 * que a diretoria HOMOLOGA os resultados. Sem PII (nome/local/zona/votos).
 */
export async function getRepresentantesPublicos(
  electionId: string,
): Promise<RepresentantesPublicos> {
  const rows = await prisma.mandato.findMany({
    where: { electionId },
    orderBy: [{ ordem: "asc" }],
    select: SELECT_PUB,
  });
  if (rows.length === 0) {
    return { temMandatos: false, vigentes: [], sucessoes: [] };
  }
  const todos = rows.map(pubFrom);
  return {
    temMandatos: true,
    vigentes: todos.filter(
      (m) => m.situacao === "ATIVO" || m.situacao === "AFASTADO",
    ),
    sucessoes: todos.filter((m) => m.situacao === "ENCERRADO"),
  };
}
