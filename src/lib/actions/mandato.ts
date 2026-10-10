"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { guard } from "@/lib/current-user";
import { registrarAuditoria } from "@/lib/audit";
import { getReportData } from "@/lib/reports";
import { apurarLocal } from "@/lib/apuracao";
import { isMotivoVacancia, MOTIVO_LABEL } from "@/lib/mandato-constants";
import type { ActionState } from "@/lib/types";

/** Parse de data (YYYY-MM-DD do <input type=date>) ao MEIO-DIA local (sem drift
 *  de fuso). Vazio → agora. */
function parseData(value: unknown): Date {
  const s = String(value ?? "").trim();
  if (!s) return new Date();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  const d = new Date(m ? `${m[1]}T12:00:00` : s);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function ok(message: string): ActionState {
  return { status: "success", message };
}
function err(message: string): ActionState {
  return { status: "error", message };
}

/**
 * HOMOLOGAR resultados → materializa a camada de mandato. Para cada local
 * elegível (encerrado, sem empate, com eleitos e ainda não homologado), cria um
 * Mandato TITULAR (ATIVO) por eleito e um SUPLENTE (RESERVA) por suplente, com
 * os votos congelados. Deriva da apuração canônica (getReportData) — nunca
 * diverge. Idempotente: locais já homologados são pulados.
 * formData: ano (obrigatório), workplaceId (opcional → só aquele local).
 */
export async function homologarResultados(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const gp = await guard("pleitos", "EDIT");
  if ("error" in gp) return err(gp.error);

  const ano = Number(formData.get("ano"));
  const workplaceId = String(formData.get("workplaceId") ?? "").trim();
  if (!Number.isInteger(ano)) return err("Ano inválido.");

  const election = await prisma.election.findFirst({
    where: { ano },
    orderBy: [{ isEleicaoEspecial: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  if (!election) return err("Pleito não encontrado para este ano.");

  const [report, existentes] = await Promise.all([
    getReportData({ anoEleicao: ano, somenteEncerradas: true }),
    prisma.mandato.findMany({
      where: { anoEleicao: ano },
      select: { workplaceId: true },
    }),
  ]);
  const jaHomologados = new Set(existentes.map((m) => m.workplaceId));

  let alvos = report.apuracoes.filter(
    (a) =>
      a.status === "closed" &&
      !a.temEmpate &&
      !a.semRepresentacao &&
      a.eleitos.length > 0 &&
      !jaHomologados.has(a.id),
  );
  if (workplaceId) alvos = alvos.filter((a) => a.id === workplaceId);

  if (alvos.length === 0) {
    return err(
      "Nada a homologar: resolva empates e confira se há eleitos; locais já homologados são ignorados.",
    );
  }

  // rodadaAtual por local (rastro na homologação).
  const wps = await prisma.workplace.findMany({
    where: { id: { in: alvos.map((a) => a.id) } },
    select: { id: true, rodadaAtual: true },
  });
  const rodadaById = new Map(wps.map((w) => [w.id, w.rodadaAtual]));

  // Materializa pela apuração CANÔNICA por id (à prova de candidatos homônimos e
  // preenchendo candidateIdOrigem). Em lotes, para não esgotar o pool.
  const data: Prisma.MandatoCreateManyInput[] = [];
  const LOTE = 8;
  for (let i = 0; i < alvos.length; i += LOTE) {
    const fatia = alvos.slice(i, i + LOTE);
    const apurados = await Promise.all(
      fatia.map(async (a) => ({ a, ap: await apurarLocal(a.id) })),
    );
    for (const { a, ap } of apurados) {
      // Segurança: se mudou desde o getReportData, não materializa com empate.
      if (ap.temEmpate || ap.eleitos.length === 0) continue;
      const base = {
        electionId: election.id,
        anoEleicao: ano,
        workplaceId: a.id,
        rodadaHomologada: rodadaById.get(a.id) ?? 1,
        homologadoPorNome: gp.user.nome,
      };
      ap.eleitos.forEach((e, idx) => {
        data.push({
          ...base,
          nome: e.nome,
          candidateIdOrigem: e.id,
          papel: "TITULAR",
          ordem: idx + 1,
          votosHomologados: e.votos,
          situacao: "ATIVO",
        });
      });
      ap.suplentes.forEach((s, idx) => {
        data.push({
          ...base,
          nome: s.nome,
          candidateIdOrigem: s.id,
          papel: "SUPLENTE",
          ordem: idx + 1,
          votosHomologados: s.votos,
          situacao: "RESERVA",
        });
      });
    }
  }

  if (data.length === 0) {
    return err("Nada a homologar após a conferência (empates ou sem eleito).");
  }
  // skipDuplicates + @@unique([workplaceId,papel,ordem]) = idempotente sob corrida.
  await prisma.mandato.createMany({ data, skipDuplicates: true });

  const totalLocais = new Set(data.map((d) => d.workplaceId)).size;
  const titulares = data.filter((d) => d.papel === "TITULAR").length;
  const suplentes = data.length - titulares;
  await registrarAuditoria("HOMOLOGOU_RESULTADO", {
    alvo: totalLocais === 1 ? alvos[0].nome : `${totalLocais} locais`,
    detalhe: `${titulares} titular(es) + ${suplentes} suplente(s)`,
    user: gp.user,
  });
  revalidatePath("/admin/representantes");
  revalidatePath("/transparencia");
  return ok(
    `Homologado: ${totalLocais} local(is) — ${titulares} titular(es) e ${suplentes} suplente(s) registrados.`,
  );
}

/** Carrega um mandato + nome do local (para alvo da auditoria). */
async function loadMandato(id: string) {
  return prisma.mandato.findUnique({
    where: { id },
    select: {
      id: true,
      nome: true,
      papel: true,
      situacao: true,
      workplaceId: true,
      assumiuEm: true,
      posseEm: true,
      workplace: { select: { nome: true } },
    },
  });
}

/**
 * REGISTRAR VACÂNCIA — um titular (ou suplente convocado) deixa o mandato no
 * meio do triênio. Marca ENCERRADO com motivo + data (preserva o histórico, NÃO
 * reescreve a apuração). Depois a diretoria convoca o suplente.
 * formData: id, motivo, data (opcional), observacao (opcional).
 */
export async function registrarVacancia(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const gp = await guard("pleitos", "EDIT");
  if ("error" in gp) return err(gp.error);

  const id = String(formData.get("id") ?? "").trim();
  const motivo = String(formData.get("motivo") ?? "").trim();
  const observacao = String(formData.get("observacao") ?? "").trim() || null;
  if (!id) return err("Representante inválido.");
  if (!isMotivoVacancia(motivo)) return err("Motivo de vacância inválido.");

  const m = await loadMandato(id);
  if (!m) return err("Representante não encontrado.");
  if (m.situacao === "ENCERRADO") return err("Este mandato já está encerrado.");
  if (m.situacao === "RESERVA")
    return err("Este é um suplente em reserva — não há mandato a encerrar.");

  await prisma.mandato.update({
    where: { id },
    data: {
      situacao: "ENCERRADO",
      saidaMotivo: motivo,
      saidaEm: parseData(formData.get("data")),
      observacao,
    },
  });
  await registrarAuditoria("REGISTROU_VACANCIA", {
    alvo: `${m.nome} — ${m.workplace.nome}`,
    detalhe: MOTIVO_LABEL[motivo],
    user: gp.user,
  });
  revalidatePath("/admin/representantes");
  revalidatePath("/transparencia");
  return ok(
    `Vacância registrada (${MOTIVO_LABEL[motivo]}). Convoque o próximo suplente para preencher a vaga.`,
  );
}

/**
 * CONVOCAR SUPLENTE — promove o próximo suplente em RESERVA (menor ordem) do
 * local a exercer o mandato. Registra quem substituiu e quando assumiu.
 * formData: workplaceId, substituiuNome (opcional, para o histórico).
 */
export async function convocarSuplente(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const gp = await guard("pleitos", "EDIT");
  if ("error" in gp) return err(gp.error);

  const workplaceId = String(formData.get("workplaceId") ?? "").trim();
  const substituiuNome =
    String(formData.get("substituiuNome") ?? "").trim() || null;
  if (!workplaceId) return err("Local inválido.");

  // Guarda contra SUPER-CONVOCAÇÃO: só convoca se existe vaga aberta de fato
  // (servindo < cadeiras). Sem isso, chamadas repetidas/stale colocariam mais
  // gente em exercício do que o número de cadeiras do local.
  const [seats, servindo] = await Promise.all([
    prisma.mandato.count({ where: { workplaceId, papel: "TITULAR" } }),
    prisma.mandato.count({
      where: { workplaceId, situacao: { in: ["ATIVO", "AFASTADO"] } },
    }),
  ]);
  if (servindo >= seats) {
    return err(
      "Não há vaga aberta neste local. Registre a vacância de um titular antes de convocar um suplente.",
    );
  }

  const proximo = await prisma.mandato.findFirst({
    where: { workplaceId, papel: "SUPLENTE", situacao: "RESERVA" },
    orderBy: { ordem: "asc" },
    select: { id: true, nome: true, workplace: { select: { nome: true } } },
  });
  if (!proximo) {
    return err(
      "Não há suplente em reserva neste local. Para preencher a vaga, abra uma eleição suplementar pelo local.",
    );
  }

  await prisma.mandato.update({
    where: { id: proximo.id },
    data: { situacao: "ATIVO", assumiuEm: new Date(), substituiuNome },
  });
  await registrarAuditoria("CONVOCOU_SUPLENTE", {
    alvo: `${proximo.nome} — ${proximo.workplace.nome}`,
    detalhe: substituiuNome ? `no lugar de ${substituiuNome}` : null,
    user: gp.user,
  });
  revalidatePath("/admin/representantes");
  revalidatePath("/transparencia");
  return ok(`${proximo.nome} convocado(a) e agora está em exercício.`);
}

/** AFASTAR (licença temporária): ATIVO → AFASTADO. formData: id, observacao. */
export async function afastarRepresentante(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const gp = await guard("pleitos", "EDIT");
  if ("error" in gp) return err(gp.error);

  const id = String(formData.get("id") ?? "").trim();
  const observacao = String(formData.get("observacao") ?? "").trim() || null;
  if (!id) return err("Representante inválido.");

  const m = await loadMandato(id);
  if (!m) return err("Representante não encontrado.");
  if (m.situacao !== "ATIVO")
    return err("Só é possível afastar um representante em exercício.");

  await prisma.mandato.update({
    where: { id },
    data: { situacao: "AFASTADO", saidaMotivo: "LICENCA", observacao },
  });
  await registrarAuditoria("AFASTOU_REPRESENTANTE", {
    alvo: `${m.nome} — ${m.workplace.nome}`,
    user: gp.user,
  });
  revalidatePath("/admin/representantes");
  revalidatePath("/transparencia");
  return ok(`${m.nome} afastado(a) (licença). Reative quando retornar.`);
}

/** REATIVAR: AFASTADO → ATIVO (fim da licença). formData: id. */
export async function reativarRepresentante(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const gp = await guard("pleitos", "EDIT");
  if ("error" in gp) return err(gp.error);

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return err("Representante inválido.");

  const m = await loadMandato(id);
  if (!m) return err("Representante não encontrado.");
  if (m.situacao !== "AFASTADO")
    return err("Este representante não está afastado.");

  await prisma.mandato.update({
    where: { id },
    data: { situacao: "ATIVO", saidaMotivo: null },
  });
  await registrarAuditoria("REATIVOU_REPRESENTANTE", {
    alvo: `${m.nome} — ${m.workplace.nome}`,
    user: gp.user,
  });
  revalidatePath("/admin/representantes");
  revalidatePath("/transparencia");
  return ok(`${m.nome} reativado(a) e de volta ao exercício.`);
}

/** REGISTRAR POSSE: grava a data de posse. formData: id, data. */
export async function registrarPosse(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const gp = await guard("pleitos", "EDIT");
  if ("error" in gp) return err(gp.error);

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return err("Representante inválido.");
  const m = await loadMandato(id);
  if (!m) return err("Representante não encontrado.");

  await prisma.mandato.update({
    where: { id },
    data: { posseEm: parseData(formData.get("data")) },
  });
  await registrarAuditoria("REGISTROU_POSSE", {
    alvo: `${m.nome} — ${m.workplace.nome}`,
    user: gp.user,
  });
  revalidatePath("/admin/representantes");
  revalidatePath("/transparencia");
  return ok(`Posse registrada para ${m.nome}.`);
}

/**
 * REABRIR MANDATO — desfaz uma vacância (ENCERRADO → ATIVO) ou uma convocação
 * (suplente convocado ATIVO → RESERVA). Corrige um registro feito por engano.
 * formData: id.
 */
export async function reverterMandato(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const gp = await guard("pleitos", "EDIT");
  if ("error" in gp) return err(gp.error);

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return err("Representante inválido.");
  const m = await loadMandato(id);
  if (!m) return err("Representante não encontrado.");

  if (m.situacao === "ENCERRADO") {
    await prisma.mandato.update({
      where: { id },
      data: { situacao: "ATIVO", saidaEm: null, saidaMotivo: null },
    });
    await registrarAuditoria("REABRIU_MANDATO", {
      alvo: `${m.nome} — ${m.workplace.nome}`,
      user: gp.user,
    });
  } else if (m.papel === "SUPLENTE" && m.assumiuEm) {
    // Desfaz convocação: suplente volta para a reserva.
    await prisma.mandato.update({
      where: { id },
      data: { situacao: "RESERVA", assumiuEm: null, substituiuNome: null },
    });
    await registrarAuditoria("DESFEZ_CONVOCACAO", {
      alvo: `${m.nome} — ${m.workplace.nome}`,
      user: gp.user,
    });
  } else {
    return err("Nada a reverter neste registro.");
  }
  revalidatePath("/admin/representantes");
  revalidatePath("/transparencia");
  return ok("Registro revertido.");
}

/**
 * DESFAZER HOMOLOGAÇÃO de um local — só quando NENHUM evento de mandato ocorreu
 * (todos os titulares ATIVO sem posse/saída e todos os suplentes em RESERVA).
 * Válvula de segurança para uma homologação equivocada. formData: workplaceId.
 */
export async function desfazerHomologacao(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const gp = await guard("pleitos", "EDIT");
  if ("error" in gp) return err(gp.error);

  const workplaceId = String(formData.get("workplaceId") ?? "").trim();
  if (!workplaceId) return err("Local inválido.");

  const mandatos = await prisma.mandato.findMany({
    where: { workplaceId },
    select: {
      situacao: true,
      papel: true,
      posseEm: true,
      saidaEm: true,
      assumiuEm: true,
      workplace: { select: { nome: true } },
    },
  });
  if (mandatos.length === 0) return err("Este local não está homologado.");

  const intocado = mandatos.every(
    (m) =>
      !m.posseEm &&
      !m.saidaEm &&
      !m.assumiuEm &&
      ((m.papel === "TITULAR" && m.situacao === "ATIVO") ||
        (m.papel === "SUPLENTE" && m.situacao === "RESERVA")),
  );
  if (!intocado) {
    return err(
      "Não é possível desfazer: já há posse, afastamento, vacância ou convocação registrados neste local.",
    );
  }

  const nome = mandatos[0].workplace.nome;
  await prisma.mandato.deleteMany({ where: { workplaceId } });
  await registrarAuditoria("DESFEZ_HOMOLOGACAO", { alvo: nome, user: gp.user });
  revalidatePath("/admin/representantes");
  revalidatePath("/transparencia");
  return ok(`Homologação de ${nome} desfeita.`);
}

/**
 * POSSE COLETIVA — empossa de uma vez todos os representantes EM EXERCÍCIO
 * (ATIVO/AFASTADO) do ano que ainda NÃO têm posse, com a MESMA data (a da
 * cerimônia). Quem já foi empossado não é alterado (não sobrescreve). Ideal para
 * a festa de posse do sindicato. formData: ano, data.
 */
export async function empossarColetivo(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const gp = await guard("pleitos", "EDIT");
  if ("error" in gp) return err(gp.error);

  const ano = Number(formData.get("ano"));
  if (!Number.isInteger(ano)) return err("Ano inválido.");
  const data = parseData(formData.get("data"));

  const res = await prisma.mandato.updateMany({
    where: {
      anoEleicao: ano,
      situacao: { in: ["ATIVO", "AFASTADO"] },
      posseEm: null,
    },
    data: { posseEm: data },
  });
  if (res.count === 0) {
    return err(
      "Ninguém aguardando posse: todos os representantes em exercício já têm posse registrada.",
    );
  }

  await registrarAuditoria("EMPOSSOU_COLETIVO", {
    alvo: `${res.count} representante(s)`,
    detalhe: `posse em ${data.toLocaleDateString("pt-BR")}`,
    user: gp.user,
  });
  revalidatePath("/admin/representantes");
  revalidatePath("/transparencia");
  return ok(
    `Posse coletiva registrada: ${res.count} representante(s) empossado(s) em ${data.toLocaleDateString("pt-BR")}.`,
  );
}
