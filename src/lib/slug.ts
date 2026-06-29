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
