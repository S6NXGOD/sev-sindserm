"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { registrarAuditoria } from "@/lib/audit";
import { validarFoto } from "@/lib/foto";
import type { ActionState } from "@/lib/types";

/**
 * Atualiza o PRÓPRIO perfil (nome de exibição e foto). Não exige nenhuma
 * permissão de módulo — é sobre o próprio usuário logado. Não altera papéis.
 */
export async function updateMyProfile(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const me = await getCurrentUser();
  if (!me) return { status: "error", message: "Sessão expirada. Faça login." };

  const nome = String(formData.get("nome") ?? "").trim().slice(0, 80);
  const foto = validarFoto(formData.get("fotoUrl"));
  if (!nome) return { status: "error", message: "Informe o nome de exibição." };
  if (!foto.ok) return { status: "error", message: foto.error };

  await prisma.user.update({
    where: { id: me.id },
    data: { nome, fotoUrl: foto.value },
  });
  await registrarAuditoria("EDITOU_PERFIL", { user: me });

  revalidatePath("/admin", "layout");
  return { status: "success", message: "Perfil atualizado." };
}
