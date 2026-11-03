// Cruzamento ROBUSTO de nomes (eleito × votante), tolerante a abreviações
// (iniciais) e a sobrenomes a mais, mas com viés de PRECISÃO: telefone ERRADO
// (PII) é pior que telefone ausente. Puro / client-safe (sem imports server).
//
// Ex.: "Francisco S. Soares" casa com "Francisco Sinésio Soares" (inicial);
//      "Maria Silva" NÃO casa com "Maria Souza" (sobrenome diferente).

const CONECTORES = new Set([
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "del",
  "di",
  "du",
  "la",
]);

/** Normaliza e divide o nome em tokens (sem acento/pontuação/conectores). */
export function tokensNome(nome: string): string[] {
  return (nome ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ") // tira pontuação (o "." de "S." vira espaço)
    .split(/\s+/)
    .filter((t) => t && !CONECTORES.has(t));
}

/** Dois tokens são compatíveis se iguais, ou se um é inicial do outro. */
function tokenCompat(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length === 1) return b.startsWith(a);
  if (b.length === 1) return a.startsWith(b);
  return false;
}

export type Confianca = "forte" | "parcial";

/**
 * Compara dois nomes. Retorna a confiança do match, ou null se não casam.
 * Regra: TODOS os tokens do nome mais CURTO precisam alinhar, em ordem, a tokens
 * distintos do mais LONGO (igualdade ou inicial), E os primeiros tokens casam.
 * "forte" exige ≥2 tokens com primeiro E último plenos (sem depender de inicial
 * nos extremos); senão "parcial".
 */
export function compararNomes(n1: string, n2: string): Confianca | null {
  const a = tokensNome(n1);
  const b = tokensNome(n2);
  if (a.length === 0 || b.length === 0) return null;
  const curto = a.length <= b.length ? a : b;
  const longo = a.length <= b.length ? b : a;

  // Alinhamento greedy EM ORDEM: cada token do curto consome um token do longo.
  let j = 0;
  for (let i = 0; i < curto.length; i++) {
    let achou = false;
    while (j < longo.length) {
      const compat = tokenCompat(curto[i], longo[j]);
      j++;
      if (compat) {
        achou = true;
        break;
      }
    }
    if (!achou) return null; // um token do curto não alinhou → não casa
  }

  // Primeiro token do nome precisa casar (não basta alinhar no meio).
  if (!tokenCompat(a[0], b[0])) return null;

  const primeiroPleno = a[0] === b[0];
  const ultimoPleno = a[a.length - 1] === b[b.length - 1];
  if (curto.length >= 2 && primeiroPleno && ultimoPleno) return "forte";
  return "parcial";
}

function soDigitos(t: string | null | undefined): string {
  return (t ?? "").replace(/\D/g, "");
}

export type ConfiancaMatch =
  | "forte"
  | "parcial"
  | "ambiguo"
  | "sem_telefone"
  | "nao_encontrado";

export type MatchTelefone = {
  telefone: string | null;
  confianca: ConfiancaMatch;
  /** Nome do votante casado (para conferência pela diretoria). */
  votanteNome: string | null;
  /** Quantidade de votantes que casaram (relevante quando ambíguo). */
  qtd: number;
};

/**
 * Escolhe o telefone de um eleito entre os VOTANTES DO MESMO LOCAL. PII-safe:
 * com mais de um casamento distinto, só resolve se todos compartilham o MESMO
 * telefone; senão marca "ambiguo" (a diretoria confere à mão).
 */
export function selecionarTelefone(
  eleitoNome: string,
  votantes: { nome: string; telefone: string | null }[],
): MatchTelefone {
  const fortes: typeof votantes = [];
  const parciais: typeof votantes = [];
  for (const v of votantes) {
    const c = compararNomes(eleitoNome, v.nome);
    if (c === "forte") fortes.push(v);
    else if (c === "parcial") parciais.push(v);
  }

  const escolher = (lista: typeof votantes, conf: Confianca): MatchTelefone => {
    if (lista.length === 1) {
      const v = lista[0];
      const ok = soDigitos(v.telefone).length >= 8;
      return {
        telefone: ok ? v.telefone : null,
        confianca: ok ? conf : "sem_telefone",
        votanteNome: v.nome,
        qtd: 1,
      };
    }
    // >1 casamento: só resolve se TODOS têm o MESMO telefone válido.
    const tels = lista.map((v) => soDigitos(v.telefone));
    const todosMesmo =
      tels[0].length >= 8 && tels.every((t) => t === tels[0]);
    if (todosMesmo) {
      return {
        telefone: lista[0].telefone,
        confianca: conf,
        votanteNome: lista[0].nome,
        qtd: lista.length,
      };
    }
    return {
      telefone: null,
      confianca: "ambiguo",
      votanteNome: null,
      qtd: lista.length,
    };
  };

  if (fortes.length >= 1) return escolher(fortes, "forte");
  if (parciais.length >= 1) return escolher(parciais, "parcial");
  return { telefone: null, confianca: "nao_encontrado", votanteNome: null, qtd: 0 };
}
