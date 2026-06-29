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
 * Slug base de um PLEITO (Election) — concatena OBRIGATORIAMENTE o ano para
 * evitar conflito entre eleições de anos diferentes ou nomes parecidos.
 * Ex.: generateSlug("Eleição de Base", 2026) -> "eleicao-de-base-2026".
 * A garantia de unicidade (sufixo incremental) é feita na Server Action.
 */
export function generateSlug(titulo: string, anoReferencia: number): string {
  const base = slugify(titulo) || "pleito";
  return `${base}-${anoReferencia}`;
}
