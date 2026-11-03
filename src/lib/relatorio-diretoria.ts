import { prisma } from "@/lib/prisma";
import { getEleitosDetalhado } from "@/lib/transparencia";
import { selecionarTelefone, type ConfiancaMatch } from "@/lib/nome-match";
import { formatPhoneBr } from "@/lib/phone";

// Relatório GERAL da diretoria (eleitos) com telefone cruzado dos VOTANTES do
// MESMO local. O telefone é PII: só é buscado/exibido quando `incluirTelefone`
// (gate de permissão `votantes` na página). Nunca vai ao portal público.

export type DiretoriaRow = {
  nome: string;
  local: string;
  orgao: string;
  zona: string;
  votos: number;
  /** Telefone formatado (só quando solicitado e com match). */
  telefone: string | null;
  /** Confiança do cruzamento (null quando telefone não foi solicitado). */
  confianca: ConfiancaMatch | null;
  /** Nome do votante casado (para a diretoria conferir), quando houver. */
  votanteNome: string | null;
};

export type RelatorioDiretoria = {
  ano: number;
  rows: DiretoriaRow[];
  totalEleitos: number;
  totalZonas: number;
  comTelefone: number;
  incluiTelefone: boolean;
};

/**
 * Monta o relatório: eleitos (apuração canônica, via getEleitosDetalhado) +,
 * se permitido, o telefone do votante homônimo DO MESMO LOCAL (match preciso
 * tolerante a abreviações). Ordena por zona e, dentro da zona, por nome.
 */
export async function getRelatorioDiretoria(
  electionId: string,
  incluirTelefone: boolean,
): Promise<RelatorioDiretoria | null> {
  const d = await getEleitosDetalhado(electionId);
  if (!d) return null;

  const votersByWp = new Map<
    string,
    { nome: string; telefone: string | null }[]
  >();
  if (incluirTelefone) {
    const wids = [...new Set(d.rows.map((r) => r.workplaceId))];
    if (wids.length > 0) {
      const voters = await prisma.voter.findMany({
        where: { anoEleicao: d.ano, workplaceId: { in: wids } },
        select: { nome: true, telefone: true, workplaceId: true },
      });
      for (const v of voters) {
        const arr = votersByWp.get(v.workplaceId) ?? [];
        arr.push({ nome: v.nome, telefone: v.telefone });
        votersByWp.set(v.workplaceId, arr);
      }
    }
  }

  const rows: DiretoriaRow[] = d.rows.map((r) => {
    if (!incluirTelefone) {
      return {
        nome: r.eleito,
        local: r.local,
        orgao: r.orgao,
        zona: r.zona,
        votos: r.votos,
        telefone: null,
        confianca: null,
        votanteNome: null,
      };
    }
    const m = selecionarTelefone(r.eleito, votersByWp.get(r.workplaceId) ?? []);
    return {
      nome: r.eleito,
      local: r.local,
      orgao: r.orgao,
      zona: r.zona,
      votos: r.votos,
      telefone: m.telefone ? formatPhoneBr(m.telefone) : null,
      confianca: m.confianca,
      votanteNome: m.votanteNome,
    };
  });

  // Ordena por ZONA (ordem fixa) e, dentro, por NOME (alfabético).
  const ordemZona = ["NORTE", "SUL", "LESTE", "CENTRO", "SUDESTE", "RURAL"];
  rows.sort(
    (a, b) =>
      ordemZona.indexOf(a.zona) - ordemZona.indexOf(b.zona) ||
      a.zona.localeCompare(b.zona, "pt") ||
      a.nome.localeCompare(b.nome, "pt"),
  );

  const totalZonas = new Set(rows.map((r) => r.zona)).size;
  const comTelefone = rows.filter((r) => r.telefone).length;
  return {
    ano: d.ano,
    rows,
    totalEleitos: rows.length,
    totalZonas,
    comTelefone,
    incluiTelefone: incluirTelefone,
  };
}
