import { prisma } from "@/lib/prisma";
import { getCurrentUser, type CurrentUser } from "@/lib/current-user";

/**
 * Registra uma ação no log de auditoria (quem/o quê/quando). O autor é o usuário
 * logado (ou o passado em `user`, útil logo após criar a sessão no login).
 * NUNCA lança: uma falha de auditoria não pode derrubar a ação principal.
 *
 * `acao` é um código curto e estável (ex.: "AGENDOU_VOTACAO"); `alvo` é o objeto
 * legível (nome do local/pleito/usuário) e `detalhe` é o contexto livre.
 */
export async function registrarAuditoria(
  acao: string,
  opts?: { alvo?: string | null; detalhe?: string | null; user?: CurrentUser | null },
): Promise<void> {
  try {
    const user =
      opts?.user !== undefined ? opts.user : await getCurrentUser();
    await prisma.auditLog.create({
      data: {
        userId: user?.id ?? null,
        userNome: user?.nome ?? "Sistema",
        acao,
        alvo: opts?.alvo ?? null,
        detalhe: opts?.detalhe ?? null,
      },
    });
  } catch (e) {
    console.error("Falha ao registrar auditoria:", e);
  }
}
