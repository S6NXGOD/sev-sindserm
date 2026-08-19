import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, readSessionToken } from "@/lib/auth";
import {
  MODULO_HREF,
  normalizarPermissoes,
  pode,
  primeiroModuloHref,
  type Modulo,
  type Nivel,
  type Permissoes,
} from "@/lib/permissions";

// Módulo SERVER-ONLY (importa prisma e next/headers). Nunca é bundlado no cliente.

export type CurrentUser = {
  id: string;
  nome: string;
  username: string;
  fotoUrl: string | null;
  permissoes: Permissoes;
  mustChangePassword: boolean;
};

/**
 * Usuário logado (ou null). Valida o token (assinatura/expiração) e a versão de
 * sessão contra o banco — se o usuário foi desativado/excluído ou a versão foi
 * incrementada ("deslogar todos"/troca de senha), a sessão é considerada morta.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  const payload = await readSessionToken(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      nome: true,
      username: true,
      fotoUrl: true,
      permissoes: true,
      mustChangePassword: true,
      ativo: true,
      sessionVersion: true,
    },
  });
  if (!user || !user.ativo) return null;
  if (user.sessionVersion !== payload.sessionVersion) return null;

  return {
    id: user.id,
    nome: user.nome,
    username: user.username,
    fotoUrl: user.fotoUrl,
    permissoes: normalizarPermissoes(user.permissoes),
    mustChangePassword: user.mustChangePassword,
  };
}

/** Exige um usuário logado; senão manda para /login. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Exige um usuário com AO MENOS `nivel` no `modulo`. Sem login → /login; logado
 * sem permissão → volta ao painel (o item nem deveria aparecer, mas é a trava
 * de servidor contra acesso direto por URL).
 */
export async function requireModule(
  modulo: Modulo,
  nivel: Nivel = "VIEW",
): Promise<CurrentUser> {
  const user = await requireUser();
  if (!pode(user.permissoes, modulo, nivel)) {
    // Manda para a "home" do usuário (1º módulo que ele vê). Se ele não tem
    // acesso a nada — ou a home é a própria página — cai na tela de "sem acesso"
    // (evita loop de redirect).
    const home = primeiroModuloHref(user.permissoes);
    redirect(home && home !== MODULO_HREF[modulo] ? home : "/admin/sem-acesso");
  }
  return user;
}

/**
 * Para Server Actions que retornam DADOS (CSV/relatórios) e não um ActionState:
 * LANÇA se não houver permissão. O cliente trata a exceção. Evita vazar dados
 * sensíveis (ex.: PII de votantes) por chamada direta da action.
 */
export async function ensureModule(
  modulo: Modulo,
  nivel: Nivel = "VIEW",
): Promise<CurrentUser> {
  const g = await guard(modulo, nivel);
  if ("error" in g) throw new Error(g.error);
  return g.user;
}

/**
 * Versão para Server Actions (não redireciona; devolve erro para virar
 * ActionState). Uso: `const g = await guard("locais", "EDIT"); if ("error" in g)
 * return { status: "error", message: g.error };  ...usa g.user`.
 */
export async function guard(
  modulo: Modulo,
  nivel: Nivel = "EDIT",
): Promise<{ user: CurrentUser } | { error: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sessão expirada. Faça login novamente." };
  if (!pode(user.permissoes, modulo, nivel)) {
    return { error: "Você não tem permissão para esta ação." };
  }
  return { user };
}

/**
 * Como `guard`, mas passa se o usuário atender a QUALQUER um dos (modulo, nivel)
 * — útil para ações compartilhadas por mais de um módulo (ex.: galeria de mídia,
 * usada por Configurações e por Pleitos).
 */
export async function guardAny(
  checks: Array<[Modulo, Nivel]>,
): Promise<{ user: CurrentUser } | { error: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sessão expirada. Faça login novamente." };
  if (!checks.some(([m, n]) => pode(user.permissoes, m, n))) {
    return { error: "Você não tem permissão para esta ação." };
  }
  return { user };
}
