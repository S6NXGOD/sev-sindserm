import webpush from "web-push";
import { prisma } from "@/lib/prisma";

// Módulo SERVER-ONLY (usa web-push + Prisma). Nunca bundlado no cliente.

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY ?? "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? "";
const VAPID_SUBJECT =
  process.env.VAPID_SUBJECT ?? "mailto:contato@sindsermteresina.com.br";

let configurado = false;

/** Configura o web-push com as chaves VAPID. false se faltar chave (desligado). */
function garantirVapid(): boolean {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return false;
  if (!configurado) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
    configurado = true;
  }
  return true;
}

/** true quando as notificações estão configuradas (chaves VAPID presentes). */
export function pushHabilitado(): boolean {
  return Boolean(VAPID_PUBLIC && VAPID_PRIVATE);
}

export type PushPayload = {
  title: string;
  body: string;
  /** Caminho aberto ao clicar (ex.: "/admin/locais/ID"). Default: /admin. */
  url?: string;
  /** Agrupa notificações (mesma tag substitui a anterior). */
  tag?: string;
};

type SubRow = { id: string; endpoint: string; p256dh: string; auth: string };

/** Envia para uma lista de assinaturas; remove as expiradas (404/410). */
async function enviar(subs: SubRow[], payload: PushPayload): Promise<number> {
  if (subs.length === 0) return 0;
  const data = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? "/admin",
    tag: payload.tag,
  });

  let ok = 0;
  const expiradas: string[] = [];
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          data,
        );
        ok++;
      } catch (err) {
        const code = (err as { statusCode?: number }).statusCode;
        // 404/410 = assinatura morta (desinstalou/expirou) → remover.
        if (code === 404 || code === 410) expiradas.push(s.id);
        else console.error("Erro ao enviar push:", code ?? err);
      }
    }),
  );

  if (expiradas.length > 0) {
    await prisma.pushSubscription
      .deleteMany({ where: { id: { in: expiradas } } })
      .catch(() => {});
  }
  return ok;
}

/**
 * Notifica TODOS os usuários ATIVOS do painel que tenham assinatura — opcional
 * excluir o autor da ação (que já sabe o que fez).
 */
export async function notificarAdmins(
  payload: PushPayload,
  opts?: { exceptUserId?: string },
): Promise<number> {
  if (!garantirVapid()) return 0;
  const subs = await prisma.pushSubscription.findMany({
    where: {
      user: { ativo: true },
      ...(opts?.exceptUserId ? { userId: { not: opts.exceptUserId } } : {}),
    },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  return enviar(subs, payload);
}

/**
 * Fire-and-forget: dispara o push em segundo plano SEM travar (nem derrubar) a
 * ação principal. Use nas Server Actions.
 */
export function notificarAdminsBg(
  payload: PushPayload,
  opts?: { exceptUserId?: string },
): void {
  notificarAdmins(payload, opts).catch((e) =>
    console.error("Falha ao notificar (bg):", e),
  );
}
