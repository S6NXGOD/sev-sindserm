"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  createSessionToken,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import { getCurrentUser } from "@/lib/current-user";
import { registrarAuditoria } from "@/lib/audit";
import { normalizarPermissoes } from "@/lib/permissions";
import type { ActionState } from "@/lib/types";

const COOKIE_OPTS = {
  httpOnly: true as const,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_MAX_AGE_SECONDS,
};

/* -------------------------------------------------------------------------- */
/*  Anti brute-force do login (memória, por instância). FAIL-OPEN: qualquer    */
/*  imprevisto libera o login — nunca trava um admin legítimo por engano. A    */
/*  chave é usuário+IP: as falhas de um usuário não bloqueiam outro no mesmo   */
/*  IP (ex.: mesma rede da diretoria).                                          */
/* -------------------------------------------------------------------------- */
const FAIL_LIMIT = 8; // tentativas erradas antes do bloqueio temporário
const FAIL_WINDOW_MS = 15 * 60 * 1000; // janela de contagem / bloqueio
const tentativas = new Map<string, { count: number; first: number }>();

function ipDaRequisicao(): string {
  try {
    const fwd = headers().get("x-forwarded-for");
    return fwd?.split(",")[0]?.trim() || "desconhecido";
  } catch {
    return "desconhecido";
  }
}

function loginBloqueado(key: string): boolean {
  const e = tentativas.get(key);
  if (!e) return false;
  if (Date.now() - e.first > FAIL_WINDOW_MS) {
    tentativas.delete(key);
    return false;
  }
  return e.count >= FAIL_LIMIT;
}

function registrarFalhaLogin(key: string): void {
  const now = Date.now();
  const e = tentativas.get(key);
  if (!e || now - e.first > FAIL_WINDOW_MS) {
    tentativas.set(key, { count: 1, first: now });
  } else {
    e.count += 1;
  }
  // Trava de crescimento do mapa (proteção de memória).
  if (tentativas.size > 10000) tentativas.clear();
}

function limparFalhasLogin(key: string): void {
  tentativas.delete(key);
}

/**
 * Login por USUÁRIO + SENHA. Cada pessoa tem seu login; a sessão carrega a
 * identidade (para auditoria e permissões). Mensagem genérica em falha de
 * credencial (não revela se o usuário existe).
 */
export async function login(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const username = String(formData.get("username") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const redirectTo = String(formData.get("redirect") ?? "/admin");

  if (!username || !password) {
    return { status: "error", message: "Informe o usuário e a senha." };
  }

  // Anti brute-force: bloqueia temporariamente após muitas tentativas erradas.
  const throttleKey = `${username}:${ipDaRequisicao()}`;
  if (loginBloqueado(throttleKey)) {
    await registrarAuditoria("LOGIN_BLOQUEADO", { alvo: username, user: null });
    return {
      status: "error",
      message:
        "Muitas tentativas de login. Aguarde alguns minutos e tente novamente.",
    };
  }

  const user = await prisma.user.findUnique({ where: { username } });
  const senhaOk = user
    ? await verifyPassword(password, user.passwordHash)
    : false;

  if (!user || !senhaOk) {
    registrarFalhaLogin(throttleKey);
    await registrarAuditoria("LOGIN_FALHOU", { alvo: username, user: null });
    return { status: "error", message: "Usuário ou senha incorretos." };
  }
  if (!user.ativo) {
    return {
      status: "error",
      message: "Seu acesso está desativado. Fale com o administrador.",
    };
  }

  // Sucesso: zera o contador de falhas desta chave.
  limparFalhasLogin(throttleKey);

  const token = await createSessionToken(user.id, user.sessionVersion);
  cookies().set(SESSION_COOKIE, token, COOKIE_OPTS);

  await registrarAuditoria("LOGIN", {
    user: {
      id: user.id,
      nome: user.nome,
      username: user.username,
      fotoUrl: user.fotoUrl,
      permissoes: normalizarPermissoes(user.permissoes),
      mustChangePassword: user.mustChangePassword,
    },
  });

  // 1º acesso (ou após reset pelo admin): obriga a trocar a senha antes de tudo.
  if (user.mustChangePassword) redirect("/admin/trocar-senha");

  const destino =
    redirectTo.startsWith("/admin") && redirectTo !== "/admin/login"
      ? redirectTo
      : "/admin";
  redirect(destino);
}

export async function logout(): Promise<void> {
  await registrarAuditoria("LOGOUT");
  cookies().delete(SESSION_COOKIE);
  redirect("/login");
}

/**
 * Troca a PRÓPRIA senha (confirmando a atual). Incrementa a versão de sessão
 * (derruba as OUTRAS sessões do usuário) e reemite o cookie desta sessão para a
 * pessoa continuar logada aqui.
 */
export async function changeMyPassword(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const atual = await getCurrentUser();
  if (!atual) {
    return { status: "error", message: "Sessão expirada. Faça login." };
  }

  const senhaAtual = String(formData.get("senhaAtual") ?? "");
  const novaSenha = String(formData.get("novaSenha") ?? "");
  const confirmarSenha = String(formData.get("confirmarSenha") ?? "");

  const dbUser = await prisma.user.findUnique({ where: { id: atual.id } });
  if (!dbUser || !(await verifyPassword(senhaAtual, dbUser.passwordHash))) {
    return { status: "error", message: "Senha atual incorreta." };
  }
  if (novaSenha.length < 6) {
    return {
      status: "error",
      message: "A nova senha deve ter ao menos 6 caracteres.",
    };
  }
  if (novaSenha !== confirmarSenha) {
    return {
      status: "error",
      message: "A confirmação não confere com a nova senha.",
    };
  }
  if (novaSenha === senhaAtual) {
    return {
      status: "error",
      message: "A nova senha deve ser diferente da atual.",
    };
  }

  const hash = await hashPassword(novaSenha);
  const novaVersao = dbUser.sessionVersion + 1;
  await prisma.user.update({
    where: { id: atual.id },
    // Trocar a senha também limpa a obrigação de "trocar no 1º acesso".
    data: {
      passwordHash: hash,
      sessionVersion: novaVersao,
      mustChangePassword: false,
    },
  });

  // Reemite o cookie desta sessão com a nova versão (mantém o usuário logado).
  const token = await createSessionToken(atual.id, novaVersao);
  cookies().set(SESSION_COOKIE, token, COOKIE_OPTS);

  await registrarAuditoria("TROCOU_SENHA", { user: atual });
  return {
    status: "success",
    message: "Senha alterada. Suas outras sessões foram encerradas.",
  };
}
