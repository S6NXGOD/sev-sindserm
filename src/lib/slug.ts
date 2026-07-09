/**
 * Geração e validação de slug para o link público de votação.
 * Ex.: "Escola Municipal Dom Barreto" -> "escola-municipal-dom-barreto"
 */

export function slugify(value: string): string {
  return (value ?? "")
    .normalize("NFD") // separa os acentos dos caracteres base
    .replace(/[̀-ͯ]/g, "") // remove os diacríticos combinantes
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // não-alfanumérico -> hífen
    .replace(/^-+|-+$/g, "") // remove hífens das pontas
    .replace(/-{2,}/g, "-") // colapsa hífens repetidos
    .slice(0, 80);
}

/** Slug válido: minúsculas, números e hífens; 3 a 80 chars; sem hífen nas pontas. */
export function isValidSlug(value: string): boolean {
  return (
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) &&
    value.length >= 3 &&
    value.length <= 80
  );
}

/**
 * Normaliza texto para BUSCA: remove acentos, passa para minúsculas e colapsa
 * espaços (mantém os espaços, ao contrário do slugify, para casar nomes
 * compostos). Ex.: "João DA Silva" -> "joao da silva". Use o MESMO normalizador
 * no termo digitado e no campo pesquisado para uma busca acento-insensível.
 */
export function normalizeForSearch(value: string): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Quebra o texto em PALAVRAS normalizadas para busca: sem acento, minúsculas, e
 * qualquer pontuação/símbolo/espaço vira separador. Assim "GABINETE-SEC_SEMGOV"
 * e "gabinete sec semgov" produzem os mesmos tokens. Reaproveita o
 * normalizeForSearch (que já remove acentos).
 */
export function searchTokens(value: string): string[] {
  return normalizeForSearch(value)
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

/**
 * Busca DINÂMICA e ranqueada: TODAS as palavras do termo precisam aparecer no
 * texto, em QUALQUER ORDEM, ignorando acento/caixa/pontuação. Cada palavra pode
 * casar como pedaço de uma palavra do alvo (ex.: "gerenc" casa "gerência").
 * Retorna um score > 0 quando casa (quanto maior, mais relevante) e 0 quando
 * NÃO casa — palavra inteira vale mais que pedaço, e termo contíguo / no início
 * do texto ganha bônus (para o resultado certo vir primeiro).
 */
export function searchScore(haystack: string, queryTokens: string[]): number {
  if (queryTokens.length === 0) return 0;
  const hayTokens = searchTokens(haystack);
  const hayJoined = hayTokens.join(" ");
  let score = 0;
  for (const t of queryTokens) {
    if (!hayJoined.includes(t)) return 0; // faltou uma palavra do termo
    score += hayTokens.includes(t) ? 4 : 1; // palavra inteira vale mais que pedaço
  }
  const qJoined = queryTokens.join(" ");
  if (hayJoined.startsWith(qJoined)) score += 100;
  else if (hayJoined.includes(qJoined)) score += 40;
  return score;
}

/**
 * Slug base de um PLEITO (Election). PREFIXO por ano da eleição ("eleicao-<ano>-")
 * para AGRUPAR por pleito e tornar impossível a colisão entre eleições de anos
 * diferentes, mesmo com títulos iguais. Ex.: generateSlug("Eleição de Base",
 * 2026) -> "eleicao-2026-eleicao-de-base". A unicidade final (sufixo incremental
 * para títulos repetidos no MESMO ano) é garantida na Server Action.
 */
export function generateSlug(titulo: string, anoReferencia: number): string {
  const base = slugify(titulo) || "pleito";
  return `eleicao-${anoReferencia}-${base}`.slice(0, 80).replace(/-+$/, "");
}
