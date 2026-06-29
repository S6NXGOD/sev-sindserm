"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  createSessionToken,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import type { ActionState } from "@/lib/types";

const ADMIN_PASSWORD_KEY = "admin_password_hash";

/**
 * Verifica a senha do admin. Se já houver senha definida no banco (alterada
 * pelo sistema), valida contra o hash; caso contrário, usa o ADMIN_PASSWORD do
 * .env (senha de fábrica/bootstrap).
 * Não exportada: módulos "use server" expõem apenas as actions.
 */
async function verifyAdminPassword(plain: string): Promise<boolean> {
  const setting = await prisma.setting.findUnique({
    where: { key: ADMIN_PASSWORD_KEY },
  });
  if (setting?.value) {
    return verifyPassword(plain, setting.value);
  }
  const env = process.env.ADMIN_PASSWORD ?? "";
  return env.length > 0 && plain === env;
}

export async function login(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const password = String(formData.get("password") ?? "");
  const redirectTo = String(formData.get("redirect") ?? "/admin");

  const semSenhaConfigurada =
    !process.env.ADMIN_PASSWORD &&
    !(await prisma.setting.findUnique({ where: { key: ADMIN_PASSWORD_KEY } }));
  if (semSenhaConfigurada) {
    return {
      status: "error",
      message:
        "Nenhuma senha configurada. Defina ADMIN_PASSWORD no arquivo .env.",
    };
  }

  if (!(await verifyAdminPassword(password))) {
    return { status: "error", message: "Senha incorreta." };
  }

  const token = await createSessionToken();
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  // redirect lança internamente (NEXT_REDIRECT) — fora de try/catch.
  const destino =
    redirectTo.startsWith("/admin") && redirectTo !== "/admin/login"
      ? redirectTo
      : "/admin";
  redirect(destino);
}

export async function logout(): Promise<void> {
  cookies().delete(SESSION_COOKIE);
  redirect("/login");
}

/**
 * Altera a senha do administrador (confirmando a senha atual). A nova senha é
 * salva com hash (scrypt) na tabela Setting e passa a valer no próximo login.
 */
export async function changeAdminPassword(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const senhaAtual = String(formData.get("senhaAtual") ?? "");
  const novaSenha = String(formData.get("novaSenha") ?? "");
  const confirmarSenha = String(formData.get("confirmarSenha") ?? "");

  if (!(await verifyAdminPassword(senhaAtual))) {
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
  await prisma.setting.upsert({
    where: { key: ADMIN_PASSWORD_KEY },
    update: { value: hash },
    create: { key: ADMIN_PASSWORD_KEY, value: hash },
  });

  return { status: "success", message: "Senha alterada com sucesso." };
}
