/**
 * Cálculo de vagas de eleitos por Local de Trabalho.
 *
 * A quantidade de eleitos depende ESTRITAMENTE do número total de candidatos
 * cadastrados (`totalCandidatos`) no local:
 *
 *   1–9   -> 1 vaga
 *   10–16 -> 2 vagas
 *   17–19 -> 3 vagas
 *   20–26 -> 4 vagas
 *   27–29 -> 5 vagas
 *   30–36 -> 6 vagas
 *   ...
 *
 * A progressão se repete infinitamente: uma NOVA vaga é aberta sempre que o
 * total de candidatos atinge um número terminado em 0 ou em 7
 * (ex.: 37 -> 7 vagas, 40 -> 8 vagas, 47 -> 9, 50 -> 10, ...).
 *
 * Os "gatilhos" de nova vaga, a partir de 10, são: 10, 17, 20, 27, 30, 37, ...
 * Logo: vagas = 1 + (qtde de múltiplos de 10 ≤ N) + (qtde de N≡7(mod 10), ≥17, ≤ N).
 */
export function calcularVagas(totalCandidatos: number): number {
  if (!Number.isFinite(totalCandidatos) || totalCandidatos <= 0) return 0;
  if (totalCandidatos <= 9) return 1;

  const terminadosEm0 = Math.floor(totalCandidatos / 10); // 10, 20, 30, ...
  const terminadosEm7 = Math.floor((totalCandidatos - 7) / 10); // 17, 27, 37, ...

  return 1 + terminadosEm0 + Math.max(0, terminadosEm7);
}

export type ResultadoApuracao<T> = {
  /** Número oficial de vagas do local (regra de progressão). */
  vagas: number;
  /** Candidatos eleitos de forma definitiva (ordenados por votos desc). */
  eleitos: T[];
  /** Candidatos empatados disputando a(s) vaga(s) restante(s). */
  empatados: T[];
  /** Quantidade de vagas ainda em disputa por empate na linha de corte. */
  vagasEmDisputa: number;
  /** true quando há empate na linha de corte (necessário desempate). */
  temEmpate: boolean;
};

/**
 * Apura os eleitos de um local a partir da lista de candidatos (com votos).
 * O nº de vagas é derivado do total de candidatos cadastrados (`candidatos.length`).
 *
 * - Só são elegíveis candidatos com pelo menos 1 voto.
 * - Em caso de empate na última vaga (mais candidatos do que vagas restantes
 *   com a mesma votação de corte), eles ficam em `empatados` e `temEmpate` é
 *   `true` — sinalizando que é necessário desempate.
 */
export function apurarEleitos<T extends { votos: number }>(
  candidatos: T[],
  vagasOverride?: number,
): ResultadoApuracao<T> {
  // Em listas grandes, `candidatos` pode ser apenas o TOP-N (com votos) e o
  // total real de candidatos é passado por fora via `vagasOverride`.
  const vagas =
    vagasOverride !== undefined
      ? vagasOverride
      : calcularVagas(candidatos.length);

  const comVotos = [...candidatos]
    .filter((c) => c.votos > 0)
    .sort((a, b) => b.votos - a.votos);

  if (vagas === 0 || comVotos.length === 0) {
    return {
      vagas,
      eleitos: [],
      empatados: [],
      vagasEmDisputa: 0,
      temEmpate: false,
    };
  }

  // Não é possível eleger mais candidatos do que os que receberam votos.
  const assentos = Math.min(vagas, comVotos.length);
  const votosDeCorte = comVotos[assentos - 1].votos;

  const eleitos = comVotos.filter((c) => c.votos > votosDeCorte);
  const naLinhaDeCorte = comVotos.filter((c) => c.votos === votosDeCorte);
  const vagasRestantes = assentos - eleitos.length;

  if (naLinhaDeCorte.length > vagasRestantes) {
    return {
      vagas,
      eleitos,
      empatados: naLinhaDeCorte,
      vagasEmDisputa: vagasRestantes,
      temEmpate: true,
    };
  }

  return {
    vagas,
    eleitos: comVotos.slice(0, assentos),
    empatados: [],
    vagasEmDisputa: 0,
    temEmpate: false,
  };
}
