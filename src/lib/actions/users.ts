"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { SESSION_COOKIE } from "@/lib/auth";
import { guard } from "@/lib/current-user";
import { registrarAuditoria } from "@/lib/audit";
import {
  isSuperAdmin,
  normalizarPermissoes,
  rotuloPerfil,
  type Permissoes,
} from "@/lib/permissions";
import { validarFoto } from "@/lib/foto";
import type { ActionState } from "@/lib/types";

// login: 3–30, minúsculas/números e . _ - (sem espaço/acento).
const USERNAME_RE = /^[a-z0-9._-]{3,30}$/;

/** Lê o campo "permissoes" (JSON string) do form e normaliza para o mapa válido. */
function parsePermissoes(v: unknown): Permissoes {
  try {
    return normalizarPermissoes(JSON.parse(String(v ?? "{}")));
  } catch {
    return normalizarPermissoes({});
  }
}

/**
 * Impede ficar sem NENHUM Administrador Geral ativo (quem tem usuarios=EDIT).
 * Percorre os demais usuários ativos e checa as permissões.
 */
async function seriaOUltimoSuperAdmin(userId: string): Promise<boolean> {
  const outros = await prisma.user.findMany({
    where: { ativo: true, id: { not: userId } },
    select: { permissoes: true },
  });
  return !outros.some((u) => isSuperAdmin(normalizarPermissoes(u.permissoes)));
}

export async function createUser(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const g = await guard("usuarios", "EDIT");
  if ("error" in g) return { status: "error", message: g.error };

  const nome = String(formData.get("nome") ?? "").trim().slice(0, 80);
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const senha = String(formData.get("senha") ?? "");
  const permissoes = parsePermissoes(formData.get("permissoes"));

  if (!nome) return { status: "error", message: "Informe o nome de exibição." };
  if (!USERNAME_RE.test(username)) {
    return {
      status: "error",
      message:
        "Usuário inválido. Use 3 a 30 caracteres: letras minúsculas, números, . _ -.",
    };
  }
  if (senha.length < 6) {
    return { status: "error", message: "A senha deve ter ao menos 6 caracteres." };
  }

  try {
    const hash = await hashPassword(senha);
    await prisma.user.create({
      // mustChangePassword usa o default (true): o usuário novo troca no 1º login.
      data: { nome, username, passwordHash: hash, permissoes },
    });
    await registrarAuditoria("CRIOU_USUARIO", {
      alvo: nome,
      detalhe: `@${username} · ${rotuloPerfil(permissoes)}`,
      user: g.user,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { status: "error", message: `O usuário "@${username}" já existe.` };
    }
    console.error("Erro ao criar usuário:", error);
    return { status: "error", message: "Erro ao criar o usuário." };
  }

  revalidatePath("/admin/usuarios");
  return { status: "success", message: `Usuário ${nome} criado.` };
}

/** Edita nome, foto e permissões. Não deixa remover o último Administrador Geral. */
export async function updateUser(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const g = await guard("usuarios", "EDIT");
  if ("error" in g) return { status: "error", message: g.error };

  const id = String(formData.get("id") ?? "").trim();
  const nome = String(formData.get("nome") ?? "").trim().slice(0, 80);
  const permissoes = parsePermissoes(formData.get("permissoes"));
  const foto = validarFoto(formData.get("fotoUrl"));
  if (!id) return { status: "error", message: "Usuário inválido." };
  if (!nome) return { status: "error", message: "Informe o nome de exibição." };
  if (!foto.ok) return { status: "error", message: foto.error };

  const alvo = await prisma.user.findUnique({ where: { id } });
  if (!alvo) return { status: "error", message: "Usuário não encontrado." };

  // Se o alvo é Administrador Geral e está perdendo esse poder, garante que não
  // é o último — senão ninguém mais poderia gerenciar usuários.
  const eraSuper = isSuperAdmin(normalizarPermissoes(alvo.permissoes));
  if (
    eraSuper &&
    !isSuperAdmin(permissoes) &&
    (await seriaOUltimoSuperAdmin(id))
  ) {
    return {
      status: "error",
      message: "Não é possível remover o poder do último Administrador Geral ativo.",
    };
  }

  await prisma.user.update({
    where: { id },
    data: { nome, permissoes, fotoUrl: foto.value },
  });
  await registrarAuditoria("EDITOU_USUARIO", {
    alvo: nome,
    detalhe: `perfil: ${rotuloPerfil(permissoes)}`,
    user: g.user,
  });
  revalidatePath("/admin/usuarios");
  return { status: "success", message: "Usuário atualizado." };
}

/** Ativa/desativa. Não permite desativar a si mesmo nem o último super admin. */
export async function setUserAtivo(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const g = await guard("usuarios", "EDIT");
  if ("error" in g) return { status: "error", message: g.error };

  const id = String(formData.get("id") ?? "").trim();
  const ativo = String(formData.get("ativo") ?? "") === "true";
  if (!id) return { status: "error", message: "Usuário inválido." };

  if (!ativo && id === g.user.id) {
    return { status: "error", message: "Você não pode desativar a si mesmo." };
  }

  const alvo = await prisma.user.findUnique({ where: { id } });
  if (!alvo) return { status: "error", message: "Usuário não encontrado." };

  if (
    !ativo &&
    isSuperAdmin(normalizarPermissoes(alvo.permissoes)) &&
    (await seriaOUltimoSuperAdmin(id))
  ) {
    return {
      status: "error",
      message: "Não é possível desativar o último Administrador Geral ativo.",
    };
  }

  // Desativar também incrementa a versão de sessão (derruba a sessão do alvo).
  await prisma.user.update({
    where: { id },
    data: ativo
      ? { ativo: true }
      : { ativo: false, sessionVersion: { increment: 1 } },
  });
  await registrarAuditoria(ativo ? "ATIVOU_USUARIO" : "DESATIVOU_USUARIO", {
    alvo: alvo.nome,
    user: g.user,
  });
  revalidatePath("/admin/usuarios");
  return {
    status: "success",
    message: ativo ? "Usuário reativado." : "Usuário desativado.",
  };
}

/**
 * Redefine a senha de um usuário (o alvo é deslogado das sessões atuais) e marca
 * para trocar no próximo login (senha temporária definida pelo administrador).
 */
export async function resetUserPassword(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const g = await guard("usuarios", "EDIT");
  if ("error" in g) return { status: "error", message: g.error };

  const id = String(formData.get("id") ?? "").trim();
  const senha = String(formData.get("senha") ?? "");
  if (!id) return { status: "error", message: "Usuário inválido." };
  if (senha.length < 6) {
    return { status: "error", message: "A senha deve ter ao menos 6 caracteres." };
  }

  const alvo = await prisma.user.findUnique({ where: { id } });
  if (!alvo) return { status: "error", message: "Usuário não encontrado." };

  const hash = await hashPassword(senha);
  await prisma.user.update({
    where: { id },
    data: {
      passwordHash: hash,
      mustChangePassword: true,
      sessionVersion: { increment: 1 },
    },
  });
  await registrarAuditoria("RESETOU_SENHA", { alvo: alvo.nome, user: g.user });
  revalidatePath("/admin/usuarios");
  return {
    status: "success",
    message: `Senha de ${alvo.nome} redefinida. Ele(a) trocará no próximo login.`,
  };
}

/** Exclui um usuário. Não permite excluir a si mesmo nem o último super admin. */
export async function deleteUser(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const g = await guard("usuarios", "EDIT");
  if ("error" in g) return { status: "error", message: g.error };

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { status: "error", message: "Usuário inválido." };
  if (id === g.user.id) {
    return { status: "error", message: "Você não pode excluir a si mesmo." };
  }

  const alvo = await prisma.user.findUnique({ where: { id } });
  if (!alvo) return { status: "error", message: "Usuário não encontrado." };

  if (
    isSuperAdmin(normalizarPermissoes(alvo.permissoes)) &&
    (await seriaOUltimoSuperAdmin(id))
  ) {
    return {
      status: "error",
      message: "Não é possível excluir o último Administrador Geral ativo.",
    };
  }

  // O histórico de auditoria sobrevive (userId vira null; userNome preservado).
  await prisma.user.delete({ where: { id } });
  await registrarAuditoria("EXCLUIU_USUARIO", {
    alvo: alvo.nome,
    detalhe: `@${alvo.username}`,
    user: g.user,
  });
  revalidatePath("/admin/usuarios");
  return { status: "success", message: `Usuário ${alvo.nome} excluído.` };
}

/**
 * Desloga TODOS (inclusive quem executa): incrementa a versão de sessão de todos
 * os usuários — os tokens atuais deixam de valer e todos precisam logar de novo.
 */
export async function deslogarTodos(): Promise<void> {
  const g = await guard("usuarios", "EDIT");
  if ("error" in g) return;

  await prisma.user.updateMany({ data: { sessionVersion: { increment: 1 } } });
  await registrarAuditoria("DESLOGOU_TODOS", { user: g.user });
  // Como a própria sessão também caiu, manda para o login.
  cookies().delete(SESSION_COOKIE);
  redirect("/login");
}
