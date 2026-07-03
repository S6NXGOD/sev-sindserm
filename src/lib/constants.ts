import { Zona } from "@prisma/client";

/**
 * Órgãos da Prefeitura de Teresina (lista fixa).
 * O valor armazenado é a própria string exibida.
 */
export const ORGAOS = [
  "FCMC – Fundação Cultural Monsenhor Chaves",
  "FMS – Fundação Municipal de Saúde",
  "Fundação Wall Ferraz",
  "IPMT – Instituto de Previdência dos Servidores do Município de Teresina",
  "PGM – Procuradoria Geral do Município",
  "SDR – Secretaria Municipal de Desenvolvimento Rural",
  "SAAD Centro",
  "SAAD Leste",
  "SAAD Norte",
  "SAAD Rural",
  "SAAD Sudeste",
  "SAAD Sul 1",
  "SAAD Sul 2",
  "SEMA – Secretaria Municipal de Administração",
  "SEMAN – Secretaria Municipal de Meio Ambiente",
  "SEMCASPI – Secretaria Municipal de Cidadania, Assistência Social e Políticas Integradas",
  "SEMCOM – Secretaria Municipal de Comunicação Social",
  "SEMDEC – Secretaria Municipal de Desenvolvimento Econômico e Turismo",
  "SEMDUH – Secretaria Municipal de Desenvolvimento Urbano e Habitação",
  "SEMEC – Secretaria Municipal de Educação",
  "SEMEL – Secretaria Municipal de Esportes e Lazer",
  "SEMF – Secretaria Municipal de Finanças",
  "SEMGOV – Secretaria Municipal de Governo",
  "SEMJUV – Secretaria Municipal da Juventude",
  "SEMPLAN – Secretaria Municipal de Planejamento",
  "SEMUSP – Secretaria Municipal de Segurança Pública",
  "STRANS – Superintendência Municipal de Transportes e Trânsito",
] as const;

export type Orgao = (typeof ORGAOS)[number];

export const ZONAS = Object.values(Zona) as Zona[];

export const PAGE_SIZE = 20;
