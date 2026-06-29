"use server";

import {
  getEleitosCsv,
  getResultadoLocal,
  type ResultadoLocal,
} from "@/lib/transparencia";

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
