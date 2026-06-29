"use server";

import {
  getRitmoSeries,
  type RitmoPonto,
  type RitmoRange,
} from "@/lib/dashboard";

/**
 * Server Action chamada pelo seletor de intervalo do gráfico de Ritmo (cliente).
 * Apenas repassa para getRitmoSeries (agregação em SQL).
 */
export async function fetchRitmoSeries(
  anoEleicao: number,
  range: RitmoRange,
  customInicio?: string,
  customFim?: string,
): Promise<RitmoPonto[]> {
  return getRitmoSeries(anoEleicao, range, customInicio, customFim);
}
