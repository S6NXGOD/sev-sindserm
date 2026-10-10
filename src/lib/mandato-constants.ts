// Constantes/tipos de MANDATO SEGUROS PARA O CLIENTE (sem imports de servidor).
// Espelha o padrão de documentos-constants: o módulo server (lib/mandato.ts)
// reexporta isto e adiciona as leituras via Prisma; componentes "use client"
// importam DAQUI.

export type PapelMandato = "TITULAR" | "SUPLENTE";

// Ciclo de vida de UM mandato:
//  ATIVO     — em exercício (titular ou suplente convocado que assumiu)
//  AFASTADO  — licença temporária (volta a ATIVO ao reativar)
//  ENCERRADO — saiu definitivamente (ver saidaMotivo) — abre vaga
//  RESERVA   — suplente aguardando convocação
export type SituacaoMandato = "ATIVO" | "AFASTADO" | "ENCERRADO" | "RESERVA";

export type MotivoSaida =
  | "RENUNCIA"
  | "FALECIMENTO"
  | "DESTITUICAO"
  | "PERDA_VINCULO"
  | "APOSENTADORIA"
  | "LICENCA"
  | "ABANDONO"
  | "OUTRO";

export const MOTIVO_LABEL: Record<MotivoSaida, string> = {
  RENUNCIA: "Renúncia",
  FALECIMENTO: "Falecimento",
  DESTITUICAO: "Destituição / cassação",
  PERDA_VINCULO: "Perda de vínculo",
  APOSENTADORIA: "Aposentadoria",
  LICENCA: "Licença",
  ABANDONO: "Abandono",
  OUTRO: "Outro",
};

/**
 * Motivos de SAÍDA DEFINITIVA (vacância) — abrem a vaga para o suplente. A
 * LICENÇA fica de fora porque é temporária (fluxo "Afastar/Reativar").
 */
export const MOTIVOS_VACANCIA: {
  id: MotivoSaida;
  label: string;
  descricao: string;
}[] = [
  { id: "RENUNCIA", label: "Renúncia", descricao: "Pedido voluntário de saída." },
  { id: "FALECIMENTO", label: "Falecimento", descricao: "Falecimento do representante." },
  {
    id: "DESTITUICAO",
    label: "Destituição / cassação",
    descricao: "Perda do mandato por decisão da assembleia ou processo.",
  },
  {
    id: "PERDA_VINCULO",
    label: "Perda de vínculo",
    descricao: "Exoneração, remoção para outro órgão ou fim do vínculo com a base.",
  },
  {
    id: "APOSENTADORIA",
    label: "Aposentadoria",
    descricao: "Aposentadoria do representante (conforme o estatuto).",
  },
  {
    id: "ABANDONO",
    label: "Abandono",
    descricao: "Faltas injustificadas / abandono, após o devido processo.",
  },
  { id: "OUTRO", label: "Outro", descricao: "Outro motivo — descreva na observação." },
];

/** true se `x` é um motivo de VACÂNCIA válido (exclui LICENCA). */
export function isMotivoVacancia(x: string): x is MotivoSaida {
  return MOTIVOS_VACANCIA.some((m) => m.id === x);
}

/** Representante como exibido (admin e portal) — tipo client-safe. */
export type MandatoView = {
  id: string;
  workplaceId: string;
  nome: string;
  papel: PapelMandato;
  ordem: number;
  votosHomologados: number;
  situacao: SituacaoMandato;
  posseEm: Date | null;
  saidaEm: Date | null;
  saidaMotivo: MotivoSaida | null;
  assumiuEm: Date | null;
  substituiuNome: string | null;
  observacao: string | null;
};

/** Suplente convocado = era SUPLENTE e assumiu (está em exercício). */
export function ehSuplenteConvocado(m: {
  papel: PapelMandato;
  assumiuEm: Date | null;
}): boolean {
  return m.papel === "SUPLENTE" && m.assumiuEm != null;
}

/** Data curta pt-BR (ou "—"). */
export function dataCurta(d: Date | null): string {
  return d ? new Date(d).toLocaleDateString("pt-BR") : "—";
}
