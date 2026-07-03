"use server";

import { prisma } from "@/lib/prisma";
import { normalizeForSearch } from "@/lib/slug";
import {
  getEleitosCsv,
  getResultadoLocal,
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
  const termo = normalizeForSearch(query ?? "");
  if (termo.length < 2) return [];

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

  // Poucos resultados de propósito: a busca fica leve e o filiado refina o texto
  // até achar a sua urna (evita listas gigantes de dezenas de locais).
  const MAX = 8;
  const out: UrnaPublica[] = [];
  for (const l of locais) {
    if (
      normalizeForSearch(l.nome).includes(termo) ||
      normalizeForSearch(l.orgao).includes(termo)
    ) {
      out.push(l);
      if (out.length >= MAX) break;
    }
  }
  return out;
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
