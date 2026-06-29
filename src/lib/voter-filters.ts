import type { Prisma, Zona } from "@prisma/client";

export type VoterFiltros = {
  anoEleicao: number;
  q?: string;
  zona?: string;
  orgao?: string;
  localId?: string;
  filiacao?: string; // "sim" | "nao" | undefined
};

/** Cláusula where dinâmica compartilhada pela listagem e pela exportação CSV. */
export function buildVoterWhere(f: VoterFiltros): Prisma.VoterWhereInput {
  const where: Prisma.VoterWhereInput = { anoEleicao: f.anoEleicao };

  if (f.q) where.nome = { contains: f.q, mode: "insensitive" };
  if (f.localId) where.workplaceId = f.localId;
  if (f.filiacao === "sim") where.isFiliado = true;
  else if (f.filiacao === "nao") where.isFiliado = false;

  const workplace: Prisma.WorkplaceWhereInput = {};
  if (f.zona) workplace.zona = f.zona as Zona;
  if (f.orgao) workplace.orgao = f.orgao;
  if (Object.keys(workplace).length) where.workplace = workplace;

  return where;
}
