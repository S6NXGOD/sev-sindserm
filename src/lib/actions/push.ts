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

/** Remove a assinatura deste dispositivo (ao desativar as notificações). */
export async function removePushSubscription(
  endpoint: string,
): Promise<{ ok: boolean }> {
  if (!endpoint) return { ok: false };
  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
  return { ok: true };
}
