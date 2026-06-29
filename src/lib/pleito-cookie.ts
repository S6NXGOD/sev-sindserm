/**
 * Nome do cookie que mantém o pleito (ano) selecionado na sidebar entre os
 * módulos do painel. Em arquivo próprio (sem Prisma) para poder ser importado
 * tanto no servidor quanto em componentes "use client".
 */
export const PLEITO_COOKIE = "sev_pleito_ano";
// 1 ano — a seleção do pleito persiste entre sessões do operador.
export const PLEITO_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
