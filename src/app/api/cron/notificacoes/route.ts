import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/format";
import { apurarLocal } from "@/lib/apuracao";
import { notificarAdmins, pushHabilitado } from "@/lib/push";

// web-push + Prisma exigem Node (não Edge). force-dynamic: nunca cacheia.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Janela para "prestes a começar": de 15 min antes até 40 min depois do início
// (robusto a atrasos do cron, que deve rodar a cada ~10-15 min).
const START_ANTES_MS = 15 * 60 * 1000;
const START_DEPOIS_MS = 40 * 60 * 1000;
// "Encerrando em breve": avisa quando faltam até 2h para o fim.
const ENDING_SOON_MS = 2 * 60 * 60 * 1000;
// Quantos locais recém-encerrados apurar por tick (empate/vaga vazia).
const APURA_CAP = 40;
const DAILY_KEY = "notif_daily_summary"; // Setting: última data (YYYY-MM-DD) enviada

/** Monta o corpo agregado ("A, B e mais N"). */
function listar(nomes: string[]): string {
  if (nomes.length <= 3) return nomes.join(", ");
  return `${nomes.slice(0, 3).join(", ")} e mais ${nomes.length - 3}`;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Comparação de segredo em tempo constante (evita timing side-channel). */
function segredoConfere(recebido: string | null): boolean {
  const esperado = process.env.CRON_SECRET;
  if (!esperado || !recebido) return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * CRON de notificações por TEMPO. Chamado periodicamente (a cada ~10-15 min).
 * Protegido por CRON_SECRET (header `x-cron-secret` ou ?secret=). Envia:
 *  - ⏰ prestes a começar
 *  - 🔒 encerrada automaticamente — com ⚖️ empate / 🟠 vaga vazia (acionáveis)
 *  - ⏳ encerrando em breve (até 2h antes do fim)
 *  - 📊 resumo diário (1x/dia, após 07:00 local)
 *
 * Datas/horas usam o fuso do processo (env TZ — deve ser America/Fortaleza).
 */
async function handler(req: NextRequest) {
  const secret =
    req.headers.get("x-cron-secret") ??
    new URL(req.url).searchParams.get("secret");
  if (!segredoConfere(secret)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  if (!pushHabilitado()) {
    return NextResponse.json({ ok: true, skipped: "VAPID não configurado." });
  }

  const now = new Date();
  const resultado: Record<string, number> = {};

  /* 1) Prestes a começar --------------------------------------------------- */
  const comecando = await prisma.workplace.findMany({
    where: {
      notifStartSent: false,
      dataInicioVotacao: {
        gte: new Date(now.getTime() - START_ANTES_MS),
        lte: new Date(now.getTime() + START_DEPOIS_MS),
      },
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
      url: um ? `/admin/locais/${comecando[0].id}` : "/admin/locais",
      tag: "cron-inicio",
    });
  }
  resultado.comecando = comecando.length;

  /* 2) Encerradas automaticamente (com empate/vaga vazia) ------------------ */
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

    const empates: string[] = [];
    const vazias: string[] = [];
    const limpas: { id: string; nome: string }[] = [];
    let apuradas = 0;
    for (const w of encerradas) {
      if (apuradas < APURA_CAP) {
        apuradas++;
        const a = await apurarLocal(w.id);
        if (a.temEmpate) {
          empates.push(w.nome);
          await notificarAdmins({
            title: "⚖️ Encerrou com EMPATE",
            body: `"${w.nome}" encerrou com EMPATE na linha de corte — precisa de desempate.`,
            url: `/admin/locais/${w.id}`,
            tag: `fim-${w.id}`,
          });
          continue;
        }
        if (a.vagasVazias > 0) {
          vazias.push(w.nome);
          await notificarAdmins({
            title: "🟠 Encerrou com vaga vazia",
            body: `"${w.nome}" encerrou com ${a.vagasVazias} vaga(s) sem eleito. Avalie suplementação.`,
            url: `/admin/locais/${w.id}`,
            tag: `fim-${w.id}`,
          });
          continue;
        }
      }
      limpas.push(w);
    }
    // Agregado para as encerradas "limpas" (sem empate/vaga vazia).
    if (limpas.length > 0) {
      const um = limpas.length === 1;
      await notificarAdmins({
        title: um ? "🔒 Votação encerrada" : `🔒 ${limpas.length} votações encerradas`,
        body: um
          ? `"${limpas[0].nome}" foi encerrada. Confira os eleitos.`
          : `Encerraram: ${listar(limpas.map((w) => w.nome))}.`,
        url: "/admin/encerradas",
        tag: "cron-fim",
      });
    }
    resultado.encerradas = encerradas.length;
    resultado.empates = empates.length;
    resultado.vazias = vazias.length;
  }

  /* 3) Encerrando em breve (até 2h antes do fim) --------------------------- */
  const terminando = await prisma.workplace.findMany({
    where: {
      notifEndingSoonSent: false,
      dataFimVotacao: { gt: now, lte: new Date(now.getTime() + ENDING_SOON_MS) },
      dataInicioVotacao: { not: null, lte: now },
    },
    select: { id: true, nome: true, dataFimVotacao: true },
    orderBy: { dataFimVotacao: "asc" },
    take: 200,
  });
  if (terminando.length > 0) {
    await prisma.workplace.updateMany({
      where: { id: { in: terminando.map((w) => w.id) } },
      data: { notifEndingSoonSent: true },
    });
    const um = terminando.length === 1;
    await notificarAdmins({
      title: um ? "⏳ Encerrando em breve" : `⏳ ${terminando.length} encerrando em breve`,
      body: um
        ? `"${terminando[0].nome}" encerra ${formatDateTime(terminando[0].dataFimVotacao!)}.`
        : `Encerram nas próximas 2h: ${listar(terminando.map((w) => w.nome))}.`,
      url: um ? `/admin/locais/${terminando[0].id}` : "/admin/locais",
      tag: "cron-terminando",
    });
  }
  resultado.terminando = terminando.length;

  /* 4) Resumo diário (1x/dia, após 07:00 local) --------------------------- */
  const hojeStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const jaEnviado = await prisma.setting.findUnique({ where: { key: DAILY_KEY } });
  if (now.getHours() >= 7 && jaEnviado?.value !== hojeStr) {
    const hojeInicio = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const ontemInicio = new Date(hojeInicio.getTime() - 24 * 60 * 60 * 1000);

    // OBS.: o model Vote NÃO tem timestamp (sigilo). Usamos o comparecimento
    // (Voter.createdAt) — nº de pessoas que votaram ontem.
    const [votantesOntem, encerradosOntem] = await Promise.all([
      prisma.voter.count({
        where: { createdAt: { gte: ontemInicio, lt: hojeInicio } },
      }),
      prisma.workplace.findMany({
        where: { dataFimVotacao: { gte: ontemInicio, lt: hojeInicio } },
        select: { id: true },
      }),
    ]);
    // Eleitos apurados nos locais encerrados ontem (cap para não pesar).
    let eleitos = 0;
    for (const w of encerradosOntem.slice(0, 100)) {
      eleitos += (await apurarLocal(w.id)).eleitos.length;
    }

    // Marca como "checado hoje" mesmo sem novidade (evita re-checar o dia todo).
    await prisma.setting.upsert({
      where: { key: DAILY_KEY },
      update: { value: hojeStr },
      create: { key: DAILY_KEY, value: hojeStr },
    });

    if (votantesOntem > 0 || encerradosOntem.length > 0) {
      await notificarAdmins({
        title: "📊 Resumo de ontem",
        body: `Ontem: ${votantesOntem} pessoa(s) votaram, ${encerradosOntem.length} local(is) encerrado(s), ${eleitos} eleito(s).`,
        url: "/admin",
        tag: "cron-resumo",
      });
      resultado.resumoDiario = 1;
    }
  }

  return NextResponse.json({ ok: true, ...resultado });
}

export const GET = handler;
export const POST = handler;
