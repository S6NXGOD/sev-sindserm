// Constantes/tipos de Documentos SEGUROS PARA O CLIENTE (sem imports de
// servidor). Espelha o padrão de logo-constants.ts: o módulo server
// (lib/documentos.ts) reexporta isto e adiciona as leituras via Prisma;
// componentes "use client" importam DAQUI (nunca de lib/documentos.ts, que
// puxaria o Prisma para o bundle do cliente).

// Categorias oficiais (atas, editais, etc.). A ordem é a ordem do seletor.
export const CATEGORIAS_DOCUMENTO = [
  "Ata",
  "Edital",
  "Resultado oficial",
  "Regulamento",
  "Comunicado",
  "Outro",
] as const;
export type CategoriaDocumento = (typeof CATEGORIAS_DOCUMENTO)[number];

// Limite por documento (PDF). 8 MB cobre atas digitalizadas com folga.
export const MAX_DOC_BYTES = 8_000_000;

// Prefixo público dos PDFs — servidos pelo Route Handler /api/uploads/[...file]
// (o Next.js 14 não serve arquivos gravados em /public em runtime). No disco os
// arquivos vivem em public/uploads/documentos/.
export const DOCS_PREFIX = "/api/uploads/documentos/";

/** Documento como exibido (admin e portal) — tipo client-safe. */
export type DocumentoView = {
  id: string;
  titulo: string;
  categoria: string;
  arquivoUrl: string;
  tamanho: number;
  createdAt: Date;
  publicadoPorNome: string;
};

/** Formata bytes em B/KB/MB para exibição. */
export function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}
