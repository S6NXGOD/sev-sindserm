import { prisma } from "@/lib/prisma";
import type { DocumentoView } from "@/lib/documentos-constants";

// Reexporta as constantes/tipos client-safe (fonte única em documentos-constants).
export * from "@/lib/documentos-constants";

// Campos expostos na UI (nunca o caminho físico além do arquivoUrl público).
const SELECT = {
  id: true,
  titulo: true,
  categoria: true,
  arquivoUrl: true,
  tamanho: true,
  createdAt: true,
  publicadoPorNome: true,
} as const;

/** Documentos de UM pleito (visão admin) — mais recentes primeiro. */
export async function getDocumentosDoPleito(
  electionId: string,
): Promise<DocumentoView[]> {
  return prisma.documento.findMany({
    where: { electionId },
    orderBy: { createdAt: "desc" },
    select: SELECT,
  });
}

/**
 * Documentos PÚBLICOS de um pleito (portal da transparência) — mais recentes
 * primeiro. Filtra por electionId (preciso: um documento pertence a UM pleito),
 * não por ano, para não misturar um pleito regular com uma especial do mesmo ano.
 */
export async function getDocumentosPublicos(
  electionId: string,
): Promise<DocumentoView[]> {
  return prisma.documento.findMany({
    where: { electionId },
    orderBy: { createdAt: "desc" },
    select: SELECT,
  });
}
