"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { pushHabilitado } from "@/lib/push";

/**
 * Config de push para o cliente: se está habilitado (chaves VAPID presentes) e a
 * chave PÚBLICA (necessária para o navegador criar a assinatura). Em RUNTIME —
 * assim não precisa rebuild quando você define as chaves no Railway.
 */
export async function getPushConfig(): Promise<{
  enabled: boolean;
  publicKey: string;
}> {
  return {
    enabled: pushHabilitado(),
    publicKey: process.env.VAPID_PUBLIC_KEY ?? "",
  };
}

type WebPushSub = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

// Anti-SSRF: o servidor faz POST para o `endpoint` ao enviar push. Aceitamos
// SOMENTE endpoints https de provedores de push conhecidos — assim ninguém
// consegue cadastrar um endpoint apontando para um serviço interno/metadata.
const PUSH_HOSTS = [
  "fcm.googleapis.com",
  "push.services.mozilla.com",
  "push.apple.com",
  "notify.windows.com",
  "push.microsoft.com",
];

function endpointDePushValido(endpoint: string): boolean {
  try {
    const u = new URL(endpoint);
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    return PUSH_HOSTS.some((h) => host === h || host.endsWith("." + h));
  } catch {
    return false;
  }
}

/** Salva/atualiza a assinatura do dispositivo do usuário logado. */
export async function savePushSubscription(
  sub: WebPushSub,
  userAgent?: string,
): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false };
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return { ok: false };
  }
  // Só provedores de push legítimos (evita SSRF cego via web-push).
  if (!endpointDePushValido(sub.endpoint)) return { ok: false };

  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    update: {
      userId: user.id,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      userAgent: userAgent?.slice(0, 300),
    },
    create: {
      userId: user.id,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      userAgent: userAgent?.slice(0, 300),
    },
  });
  return { ok: true };
}

/**
 * Remove a assinatura deste dispositivo (ao desativar as notificações). Exige
 * usuário logado e só remove uma assinatura DELE (evita apagar a de outro).
 */
export async function removePushSubscription(
  endpoint: string,
): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user || !endpoint) return { ok: false };
  await prisma.pushSubscription.deleteMany({
    where: { endpoint, userId: user.id },
  });
  return { ok: true };
}
