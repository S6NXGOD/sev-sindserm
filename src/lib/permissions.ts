/**
 * Permissões GRANULARES por MÓDULO — fonte ÚNICA (servidor barra ações; cliente
 * esconde o que não pode). Cada usuário tem, por módulo, um nível:
 *   NONE  (sem acesso) < VIEW (só visualizar) < EDIT (visualizar e editar)
 *
 * "Super admin" (quem gerencia usuários) = tem EDIT no módulo `usuarios`.
 */

export type Nivel = "NONE" | "VIEW" | "EDIT";

export type Modulo =
  | "dashboard"
  | "locais"
  | "encerradas"
  | "votantes"
  | "relatorios"
  | "pleitos"
  | "auditoria"
  | "usuarios"
  | "configuracoes";

export type Permissoes = Record<Modulo, Nivel>;

/** Forma leve do usuário logado, segura para componentes client. */
export type SessionUser = {
  id: string;
  nome: string;
  username: string;
  fotoUrl: string | null;
  permissoes: Permissoes;
};

const NIVEL_ORDEM: Record<Nivel, number> = { NONE: 0, VIEW: 1, EDIT: 2 };

export const MODULOS_KEYS: Modulo[] = [
  "dashboard",
  "locais",
  "encerradas",
  "votantes",
  "relatorios",
  "pleitos",
  "auditoria",
  "usuarios",
  "configuracoes",
];

/** Metadados de cada módulo para a UI (rótulo, grupo, se tem ações de edição). */
export const MODULOS: {
  key: Modulo;
  label: string;
  grupo: string;
  /** Módulos só de leitura: "editar" não muda nada (mostramos 2 níveis). */
  editavel: boolean;
}[] = [
  { key: "dashboard", label: "Dashboard", grupo: "Principal", editavel: false },
  { key: "locais", label: "Locais de Trabalho", grupo: "Principal", editavel: true },
  { key: "encerradas", label: "Encerradas & Eleitos", grupo: "Principal", editavel: false },
  { key: "votantes", label: "Votantes", grupo: "Principal", editavel: false },
  { key: "relatorios", label: "Relatórios", grupo: "Gestão", editavel: false },
  { key: "pleitos", label: "Pleitos", grupo: "Gestão", editavel: true },
  { key: "auditoria", label: "Auditoria", grupo: "Gestão", editavel: false },
  { key: "usuarios", label: "Usuários", grupo: "Administração", editavel: true },
  { key: "configuracoes", label: "Configurações", grupo: "Administração", editavel: true },
];

/** Rota principal de cada módulo (usada para navegação e "home" por permissão). */
export const MODULO_HREF: Record<Modulo, string> = {
  dashboard: "/admin",
  locais: "/admin/locais",
  encerradas: "/admin/encerradas",
  votantes: "/admin/votantes",
  relatorios: "/admin/relatorios",
  pleitos: "/admin/pleitos",
  auditoria: "/admin/auditoria",
  usuarios: "/admin/usuarios",
  configuracoes: "/admin/configuracoes",
};

/** Mapa vazio (tudo NONE) — base para preencher. */
export function permissoesVazias(): Permissoes {
  return MODULOS_KEYS.reduce((acc, k) => {
    acc[k] = "NONE";
    return acc;
  }, {} as Permissoes);
}

/** Normaliza um JSON qualquer (do banco) para um Permissoes válido e completo. */
export function normalizarPermissoes(raw: unknown): Permissoes {
  const base = permissoesVazias();
  if (raw && typeof raw === "object") {
    for (const k of MODULOS_KEYS) {
      const v = (raw as Record<string, unknown>)[k];
      if (v === "VIEW" || v === "EDIT" || v === "NONE") base[k] = v;
    }
  }
  return base;
}

/** true se o usuário tem AO MENOS o nível `min` no módulo. */
export function pode(
  perms: Permissoes | null | undefined,
  modulo: Modulo,
  min: Nivel,
): boolean {
  if (!perms) return false;
  return NIVEL_ORDEM[perms[modulo] ?? "NONE"] >= NIVEL_ORDEM[min];
}

/** É Administrador Geral (gerencia usuários) = EDIT em `usuarios`. */
export function isSuperAdmin(perms: Permissoes | null | undefined): boolean {
  return pode(perms, "usuarios", "EDIT");
}

/** Href do 1º módulo que o usuário pode ao menos ver (a "home" dele), ou null. */
export function primeiroModuloHref(perms: Permissoes): string | null {
  for (const m of MODULOS_KEYS) {
    if (pode(perms, m, "VIEW")) return MODULO_HREF[m];
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/*                    Presets (preenchem a grade rapidinho)                   */
/* -------------------------------------------------------------------------- */

export type Preset = "TOTAL" | "ADMIN" | "OPERADOR" | "AUDITOR";

export const PRESETS: { key: Preset; label: string; desc: string }[] = [
  { key: "TOTAL", label: "Acesso total", desc: "Tudo, incluindo usuários." },
  { key: "ADMIN", label: "Administrador", desc: "Pleitos, locais e resultados; sem usuários." },
  { key: "OPERADOR", label: "Operador", desc: "Cadastra locais/candidatos e agenda; sem pleitos/usuários." },
  { key: "AUDITOR", label: "Auditor", desc: "Somente leitura." },
];

export function presetPermissoes(preset: Preset): Permissoes {
  const p = permissoesVazias();
  const set = (m: Modulo, n: Nivel) => (p[m] = n);
  if (preset === "TOTAL") {
    for (const k of MODULOS_KEYS) set(k, "EDIT");
  } else if (preset === "ADMIN") {
    for (const k of MODULOS_KEYS) set(k, k === "usuarios" ? "NONE" : "EDIT");
  } else if (preset === "OPERADOR") {
    set("dashboard", "VIEW");
    set("locais", "EDIT");
    set("encerradas", "VIEW");
    set("votantes", "VIEW");
    set("relatorios", "VIEW");
    set("pleitos", "NONE");
    set("auditoria", "NONE");
    set("usuarios", "NONE");
    set("configuracoes", "VIEW");
  } else {
    // AUDITOR — só leitura em tudo (menos usuários).
    for (const k of MODULOS_KEYS) set(k, k === "usuarios" ? "NONE" : "VIEW");
  }
  return p;
}

/** Rótulo de exibição do perfil, inferido das permissões (para o badge). */
export function rotuloPerfil(perms: Permissoes): string {
  if (isSuperAdmin(perms)) return "Administrador Geral";
  const temEdit = MODULOS_KEYS.some((k) => perms[k] === "EDIT");
  const temView = MODULOS_KEYS.some((k) => perms[k] !== "NONE");
  if (perms.pleitos === "EDIT") return "Administrador";
  if (temEdit) return "Operador";
  if (temView) return "Auditor";
  return "Sem acesso";
}

export const NIVEL_LABEL: Record<Nivel, string> = {
  NONE: "Sem acesso",
  VIEW: "Só visualizar",
  EDIT: "Visualizar e editar",
};
