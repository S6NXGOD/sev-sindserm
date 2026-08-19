/**
 * Papéis e permissões do painel — fonte ÚNICA (usada no servidor para BARRAR
 * ações e no cliente para ESCONDER o que o usuário não pode fazer).
 *
 * São papéis com conjuntos FIXOS de capacidades (não permissões avulsas por
 * usuário) — simples, auditável e suficiente. Fácil de estender depois.
 */

/** Espelha o enum UserRole do Prisma (evita importar @prisma/client no client). */
export type Role = "SUPER_ADMIN" | "ADMIN" | "OPERADOR" | "AUDITOR";

/** Forma leve do usuário logado, segura para passar a componentes client. */
export type SessionUser = {
  id: string;
  nome: string;
  username: string;
  role: Role;
};

export type Capability =
  | "users" // gerenciar usuários (criar/editar/desativar/reset de senha)
  | "pleitos" // criar/editar/excluir/clonar pleitos
  | "write" // cadastrar/editar locais, candidatos, agenda, encerrar/reabrir, renúncia
  | "delete" // excluir locais/candidatos
  | "auditoria" // ver o log de auditoria
  | "read"; // ver painel/resultados/relatórios (todos os papéis)

const MATRIZ: Record<Role, Record<Capability, boolean>> = {
  SUPER_ADMIN: {
    users: true,
    pleitos: true,
    write: true,
    delete: true,
    auditoria: true,
    read: true,
  },
  ADMIN: {
    users: false,
    pleitos: true,
    write: true,
    delete: true,
    auditoria: true,
    read: true,
  },
  OPERADOR: {
    users: false,
    pleitos: false,
    write: true,
    delete: false,
    auditoria: false,
    read: true,
  },
  AUDITOR: {
    users: false,
    pleitos: false,
    write: false,
    delete: false,
    auditoria: true,
    read: true,
  },
};

/** true se o papel tem a capacidade. Papel ausente/desconhecido = nega tudo. */
export function can(role: Role | null | undefined, cap: Capability): boolean {
  if (!role) return false;
  return MATRIZ[role]?.[cap] ?? false;
}

export const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: "Administrador Geral",
  ADMIN: "Administrador",
  OPERADOR: "Operador",
  AUDITOR: "Auditor",
};

export const ROLE_DESC: Record<Role, string> = {
  SUPER_ADMIN: "Acesso total, incluindo a gestão de usuários.",
  ADMIN: "Gerencia pleitos, locais, candidatos e resultados. Não gerencia usuários.",
  OPERADOR:
    "Cadastra locais/candidatos e agenda votações. Não exclui pleitos nem gerencia usuários.",
  AUDITOR: "Somente leitura: painel, resultados, relatórios e auditoria.",
};

/** Papéis que um SUPER_ADMIN pode atribuir ao criar/editar usuários. */
export const ROLES_ATRIBUIVEIS: Role[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "OPERADOR",
  "AUDITOR",
];
