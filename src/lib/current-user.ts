import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, readSessionToken } from "@/lib/auth";
import { can, type Capability, type Role } from "@/lib/permissions";

// Módulo SERVER-ONLY (importa prisma e next/headers). Nunca é bundlado no cliente.

export type CurrentUser = {
  id: string;
  nome: string;
  username: string;
  role: Role;
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
      role: true,
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
    role: user.role as Role,
  };
}

/** Exige um usuário logado; senão manda para /login. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Exige um usuário com a capacidade. Sem login → /login; logado sem permissão →
 * volta ao painel (o item nem deveria estar visível, mas é a trava de servidor).
 */
export async function requireCapability(cap: Capability): Promise<CurrentUser> {
  const user = await requireUser();
  if (!can(user.role, cap)) redirect("/admin");
  return user;
}

/**
 * Versão para Server Actions (não redireciona; devolve erro para virar
 * ActionState). Uso: `const g = await guard("write"); if ("error" in g) return
 * { status: "error", message: g.error };  ...usa g.user`.
 */
export async function guard(
  cap: Capability,
): Promise<{ user: CurrentUser } | { error: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sessão expirada. Faça login novamente." };
  if (!can(user.role, cap)) {
    return { error: "Você não tem permissão para esta ação." };
  }
  return { user };
}

/** Aceita o enum do Prisma; útil onde já temos o UserRole tipado. */
export type { UserRole };
