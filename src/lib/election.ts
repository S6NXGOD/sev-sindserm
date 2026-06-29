import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PLEITO_COOKIE } from "@/lib/pleito-cookie";

/**
 * Guarda de PRIMEIRO ACESSO. Enquanto não existir nenhum pleito cadastrado,
 * os módulos ficam inacessíveis: redireciona para a criação do primeiro pleito.
 * Chamada no TOPO de cada página protegida (confiável em hard load e navegação
 * client-side — ao contrário de uma guarda no layout, que não re-executa).
 */
export async function requirePleito(): Promise<void> {
  const total = await prisma.election.count();
  if (total === 0) redirect("/admin/pleitos/novo");
}
import { DEFAULT_LOGO } from "@/lib/logo-constants";

// IMPORTANTE: este módulo importa o Prisma — use-o apenas no servidor
// (Server Actions e Server Components). Componentes "use client" devem receber
// o ano por prop, nunca importar daqui.

/**
 * Ano da eleição vigente. Vem de NEXT_PUBLIC_CURRENT_ELECTION_YEAR (ex.: 2026).
 * Fallback: ano atual do calendário.
 */
export function getCurrentElectionYear(): number {
  const raw = process.env.NEXT_PUBLIC_CURRENT_ELECTION_YEAR;
  const n = Number(raw);
  if (Number.isInteger(n) && n >= 2000 && n <= 3000) return n;
  return new Date().getFullYear();
}

/** Converte um parâmetro de URL (?ano=) em um ano válido, ou o ano vigente. */
export function parseElectionYear(value: string | undefined | null): number {
  const n = Number(value);
  if (Number.isInteger(n) && n >= 2000 && n <= 3000) return n;
  return getCurrentElectionYear();
}

function anoValido(value: string | undefined | null): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n >= 2000 && n <= 3000 ? n : null;
}

/**
 * Ano do pleito que o painel deve exibir, de forma PERSISTENTE entre os módulos.
 * Precedência: ?ano= explícito (auditoria/deep-link) > cookie da sidebar > vigente.
 * Assim, ao escolher um pleito na sidebar, todos os módulos passam a mostrá-lo
 * sem precisar trocar a cada navegação. (Server-only: usa cookies().)
 */
export function getSelectedElectionYear(
  searchAno?: string | null,
): number {
  return (
    anoValido(searchAno) ??
    anoValido(cookies().get(PLEITO_COOKIE)?.value) ??
    getCurrentElectionYear()
  );
}

/**
 * Anos com dados cadastrados + o ano vigente, em ordem decrescente.
 * Usado no seletor de histórico do painel (auditoria de eleições passadas).
 */
export async function getElectionYears(): Promise<number[]> {
  const rows = await prisma.workplace.findMany({
    distinct: ["anoEleicao"],
    select: { anoEleicao: true },
    orderBy: { anoEleicao: "desc" },
  });
  const set = new Set<number>(rows.map((r) => r.anoEleicao));
  set.add(getCurrentElectionYear());
  return [...set].sort((a, b) => b - a);
}

// REGRA ESTRITA DE LOGO:
// - A ÚNICA logo padrão do sistema é LOGO_DEFAULT (arquivo logo_default.png),
//   destinada EXCLUSIVAMENTE ao SINDSERM. Lógica: logoSindsermUrl || DEFAULT_LOGO.
// - NÃO existe logo padrão para Pleitos. Se logoPleitoUrl estiver vazia/nula, o
//   valor é `null` e a interface deve OCULTAR o elemento (sem imagem quebrada,
//   sem fallback).
// O caminho fica em logo-constants.ts (client-safe); reexportado aqui.
export { DEFAULT_LOGO };
export const FALLBACK_LOGO_SINDSERM = DEFAULT_LOGO;

/** Aplica a regra estrita: logoSindsermUrl || DEFAULT_LOGO. */
export function resolveSindsermLogo(url?: string | null): string {
  return url?.trim() || FALLBACK_LOGO_SINDSERM;
}

/** Aplica a regra estrita do pleito: sem fallback (null quando vazia/nula). */
export function resolvePleitoLogo(url?: string | null): string | null {
  return url?.trim() || null;
}

// Logo do SINDSERM sempre resolvida (com default); logo do pleito pode ser null.
export type ElectionLogos = { sindserm: string; pleito: string | null };

/** Rótulo do triênio/mandato: ano inicial-ano final (ano + duração). */
export function trienioLabel(ano: number, duracaoMandato = 3): string {
  return `${ano}-${ano + duracaoMandato}`;
}

/**
 * Título institucional de exibição: base do título + " - Triênio AAAA-AAAA".
 * Recalcula o sufixo a partir do ano + duração do mandato (e remove um sufixo
 * "- Triênio ..." que por acaso já exista no título salvo).
 */
export function tituloInstitucional(
  titulo: string | null | undefined,
  ano: number,
  duracaoMandato = 3,
): string {
  const base = (titulo ?? "Eleição de Representantes de Base")
    .replace(/\s*[-–]\s*Tri[êe]nio.*$/i, "")
    .trim();
  return `${base} - Triênio ${trienioLabel(ano, duracaoMandato)}`;
}

// Busca o pleito "do ano" preferindo o REGULAR (isEleicaoEspecial = false).
// `ano` deixou de ser único: um ano pode ter o pleito regular + eleições
// especiais/suplementares. Para logos/e-mail (referência institucional do ano),
// o pleito regular tem prioridade; cai numa especial só se não houver regular.
const PLEITO_DO_ANO_ORDER = [
  { isEleicaoEspecial: "asc" as const },
  { createdAt: "asc" as const },
];

/** E-mail oficial do pleito de um ano (para instruções/rodapés). */
export async function getElectionEmail(ano: number): Promise<string | null> {
  const e = await prisma.election.findFirst({
    where: { ano },
    orderBy: PLEITO_DO_ANO_ORDER,
    select: { emailOficial: true },
  });
  return e?.emailOficial?.trim() || null;
}

/**
 * Logos do pleito de um ano específico, aplicando a regra estrita:
 * SINDSERM cai no DEFAULT_LOGO; o pleito fica `null` (sem fallback) quando vazio.
 */
export async function getElectionLogos(ano: number): Promise<ElectionLogos> {
  const election = await prisma.election.findFirst({
    where: { ano },
    orderBy: PLEITO_DO_ANO_ORDER,
    select: { logoSindsermUrl: true, logoPleitoUrl: true },
  });
  return {
    sindserm: resolveSindsermLogo(election?.logoSindsermUrl),
    pleito: resolvePleitoLogo(election?.logoPleitoUrl),
  };
}

export type SidebarElection = {
  ano: number;
  trienio: string;
  logoSindserm: string;
  logoPleito: string | null;
};

/**
 * Lista de pleitos para o seletor da sidebar (anos com dados + pleitos
 * cadastrados + ano vigente), cada um com suas logos (ou fallback).
 */
export async function getElectionsForSidebar(): Promise<SidebarElection[]> {
  const [elections, wpYears] = await Promise.all([
    prisma.election.findMany({ orderBy: { ano: "desc" } }),
    prisma.workplace.findMany({
      distinct: ["anoEleicao"],
      select: { anoEleicao: true },
    }),
  ]);

  const byAno = new Map(elections.map((e) => [e.ano, e]));
  // NÃO injeta o ano vigente: enquanto não houver pleito de fato cadastrado, a
  // sidebar não deve exibir um "pleito fantasma". Lista só anos com dados reais.
  const anos = new Set<number>([
    ...elections.map((e) => e.ano),
    ...wpYears.map((w) => w.anoEleicao),
  ]);

  return [...anos]
    .sort((a, b) => b - a)
    .map((ano) => {
      const e = byAno.get(ano);
      return {
        ano,
        trienio: trienioLabel(ano),
        logoSindserm: resolveSindsermLogo(e?.logoSindsermUrl),
        logoPleito: resolvePleitoLogo(e?.logoPleitoUrl),
      };
    });
}
