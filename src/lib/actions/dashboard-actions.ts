"use server";

import {
  getLowTurnoutLocations,
  getRitmoSeries,
  type LowTurnoutLocal,
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

/**
 * Server Action do painel "Locais com Menor Adesão" (cliente). Repassa para
 * getLowTurnoutLocations, que já aplica o LIMIT no banco.
 */
export async function fetchLowTurnoutLocations(
  anoEleicao: number,
  limit = 5,
): Promise<LowTurnoutLocal[]> {
  return getLowTurnoutLocations(anoEleicao, limit);
}
