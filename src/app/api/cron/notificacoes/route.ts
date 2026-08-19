import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/format";
import { notificarAdmins, pushHabilitado } from "@/lib/push";

// web-push + Prisma exigem Node (não Edge). force-dynamic: nunca cacheia.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Janela para "prestes a começar": avisa de 15 min antes até 40 min depois do
// início (robusto a atrasos do cron, que deve rodar a cada ~10-15 min).
const START_ANTES_MS = 15 * 60 * 1000;
const START_DEPOIS_MS = 40 * 60 * 1000;

/** Monta o corpo agregado ("A, B e mais N"). */
function listar(nomes: string[]): string {
  if (nomes.length <= 3) return nomes.join(", ");
  return `${nomes.slice(0, 3).join(", ")} e mais ${nomes.length - 3}`;
}

/**
 * CRON de notificações por TEMPO. Deve ser chamado periodicamente pelo Railway
 * (a cada ~10-15 min). Protegido por CRON_SECRET (header `x-cron-secret` ou
 * ?secret=). Envia:
 *  - "prestes a começar": locais cujo início entra na janela e ainda não avisados.
 *  - "encerrada": locais cujo fim passou e ainda não avisados (encerramento
 *    automático — o manual já notifica na hora e marca notifCloseSent).
 * Marca `notifStartSent`/`notifCloseSent` para não repetir.
 */
async function handler(req: NextRequest) {
  const secret =
    req.headers.get("x-cron-secret") ??
    new URL(req.url).searchParams.get("secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  if (!pushHabilitado()) {
    return NextResponse.json({ ok: true, skipped: "VAPID não configurado." });
  }

  const now = new Date();
  const inicioMin = new Date(now.getTime() - START_ANTES_MS);
  const inicioMax = new Date(now.getTime() + START_DEPOIS_MS);

  // 1) Prestes a começar.
  const comecando = await prisma.workplace.findMany({
    where: {
      notifStartSent: false,
      dataInicioVotacao: { gte: inicioMin, lte: inicioMax },
    },
    select: { id: true, nome: true, dataInicioVotacao: true },
    orderBy: { dataInicioVotacao: "asc" },
    take: 200,
  });
  if (comecando.length > 0) {
    await prisma.workplace.updateMany({
      where: { id: { in: comecando.map((w) => w.id) } },
      data: { notifStartSent: true },
    });
    const um = comecando.length === 1;
    await notificarAdmins({
      title: um ? "⏰ Votação começando" : `⏰ ${comecando.length} votações começando`,
      body: um
        ? `"${comecando[0].nome}" começa ${formatDateTime(comecando[0].dataInicioVotacao!)}.`
        : `Estão começando: ${listar(comecando.map((w) => w.nome))}.`,
      url: um ? `/admin/locais/${comecando[0].id}` : "/admin/locais?status=open",
      tag: "cron-inicio",
    });
  }

  // 2) Encerradas automaticamente (fim no passado, já haviam começado).
  const encerradas = await prisma.workplace.findMany({
    where: {
      notifCloseSent: false,
      dataFimVotacao: { lt: now },
      dataInicioVotacao: { not: null, lte: now },
    },
    select: { id: true, nome: true },
    orderBy: { dataFimVotacao: "desc" },
    take: 200,
  });
  if (encerradas.length > 0) {
    await prisma.workplace.updateMany({
      where: { id: { in: encerradas.map((w) => w.id) } },
      data: { notifCloseSent: true },
    });
    const um = encerradas.length === 1;
    await notificarAdmins({
      title: um ? "🔒 Votação encerrada" : `🔒 ${encerradas.length} votações encerradas`,
      body: um
        ? `"${encerradas[0].nome}" foi encerrada. Confira os eleitos.`
        : `Encerraram: ${listar(encerradas.map((w) => w.nome))}.`,
      url: "/admin/encerradas",
      tag: "cron-fim",
    });
  }

  return NextResponse.json({
    ok: true,
    comecando: comecando.length,
    encerradas: encerradas.length,
  });
}

export const GET = handler;
export const POST = handler;
