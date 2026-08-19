"use server";

import { prisma } from "@/lib/prisma";
import { searchScore, searchTokens } from "@/lib/slug";
import {
  getEleitosCsv,
  getEleitosRows,
  getResultadoLocal,
  type EleitoRow,
  type ResultadoLocal,
} from "@/lib/transparencia";

export type UrnaPublica = {
  id: string;
  nome: string;
  orgao: string;
  zona: string;
  linkToken: string;
};

/**
 * Busca PÚBLICA de urnas (Central de Links da Transparência): o filiado digita
 * o nome do local (ou órgão) e recebe até 15 locais do pleito, com o linkToken
 * para montar a URL exata de votação. Acento/caixa-insensível; exige >= 2 chars.
 */
export async function searchUrnas(
  electionId: string,
  query: string,
): Promise<UrnaPublica[]> {
  // Tokens do termo: casa acento/caixa/pontuação-insensível e em qualquer ordem.
  const tokens = searchTokens(query ?? "");
  if (tokens.join("").length < 2) return [];

  const election = await prisma.election.findUnique({
    where: { id: String(electionId ?? "").trim() },
    select: { ano: true },
  });
  if (!election) return [];

  const locais = await prisma.workplace.findMany({
    where: { anoEleicao: election.ano },
    select: { id: true, nome: true, orgao: true, zona: true, linkToken: true },
    orderBy: { nome: "asc" },
  });

  // Casa por NOME ou ÓRGÃO (nome pesa mais) e ranqueia: o mais relevante vem
  // primeiro, então mesmo com o teto de resultados a urna certa aparece.
  const scored: Array<{ l: UrnaPublica; score: number }> = [];
  for (const l of locais) {
    const score =
      searchScore(l.nome, tokens) * 10 +
      searchScore(`${l.nome} ${l.orgao}`, tokens);
    if (score > 0) scored.push({ l, score });
  }
  scored.sort(
    (a, b) => b.score - a.score || a.l.nome.localeCompare(b.l.nome, "pt"),
  );

  // Poucos resultados de propósito: a busca fica leve e o filiado refina o texto
  // até achar a sua urna (evita listas gigantes de dezenas de locais).
  const MAX = 8;
  return scored.slice(0, MAX).map((s) => s.l);
}

/**
 * Server Actions PÚBLICAS do Portal da Transparência (sem login). Apenas leitura.
 */
export async function fetchResultadoLocal(
  workplaceId: string,
): Promise<ResultadoLocal | null> {
  const id = String(workplaceId ?? "").trim();
  if (!id) return null;
  return getResultadoLocal(id);
}

export async function fetchEleitosCsv(
  electionId: string,
): Promise<{ filename: string; csv: string } | null> {
  const id = String(electionId ?? "").trim();
  if (!id) return null;
  return getEleitosCsv(id);
}

/** Dados estruturados dos eleitos (para gerar o PDF geral no cliente). */
export async function fetchEleitosRows(
  electionId: string,
): Promise<{ ano: number; rows: EleitoRow[] } | null> {
  const id = String(electionId ?? "").trim();
  if (!id) return null;
  return getEleitosRows(id);
}
