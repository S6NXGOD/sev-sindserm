"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma, Zona } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ORGAOS, ZONAS } from "@/lib/constants";
import { isValidSlug, slugify } from "@/lib/slug";
import { formatDateTime } from "@/lib/format";
import { buildVoterWhere, type VoterFiltros } from "@/lib/voter-filters";
import type { ActionState } from "@/lib/types";

function parseLocalDateTime(value: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Retorna null (ilimitado), um inteiro >= 1, ou "invalid". */
function parseVoteLimit(raw: FormDataEntryValue | null): number | null | "invalid" {
  const value = String(raw ?? "").trim();
  if (value === "" || value.toLowerCase() === "ilimitado") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) return "invalid";
  return n;
}

const ZONA_VALUES = ZONAS as string[];
const ORGAO_VALUES = ORGAOS as readonly string[];

/* -------------------------------------------------------------------------- */
/*                              Locais de Trabalho                             */
/* -------------------------------------------------------------------------- */

export async function createWorkplace(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const nome = String(formData.get("nome") ?? "").trim();
  const zona = String(formData.get("zona") ?? "").trim();
  const orgao = String(formData.get("orgao") ?? "").trim();
  const slugInput = String(formData.get("slug") ?? "").trim();
  const inicioRaw = String(formData.get("dataInicioVotacao") ?? "");
  const fimRaw = String(formData.get("dataFimVotacao") ?? "");
  const voteLimit = parseVoteLimit(formData.get("voteLimit"));
  // CONTEXTO OBRIGATÓRIO: o pleito (ano) vem ESTRITAMENTE do formulário (injetado
  // a partir do pleito selecionado na sidebar). NUNCA usar o ano vigente fixo —
  // era a causa do vazamento de contexto (salvava sempre em 2026).
  const anoEleicao = Number(formData.get("anoEleicao"));

  if (voteLimit === "invalid") {
    return {
      status: "error",
      message: "Limite de votos inválido. Use um número inteiro ≥ 1.",
    };
  }

  if (!Number.isInteger(anoEleicao) || anoEleicao < 2000 || anoEleicao > 3000) {
    return {
      status: "error",
      message:
        "Pleito inválido. Selecione um pleito na barra lateral antes de cadastrar o local.",
    };
  }

  if (!nome) {
    return { status: "error", message: "Informe o nome do local de trabalho." };
  }
  if (!ZONA_VALUES.includes(zona)) {
    return { status: "error", message: "Selecione uma zona válida." };
  }
  if (!ORGAO_VALUES.includes(orgao)) {
    return { status: "error", message: "Selecione um órgão válido da lista." };
  }

  // Slug: usa o informado ou deriva do nome. Valida o formato.
  const slug = slugInput ? slugify(slugInput) : slugify(nome);
  if (!isValidSlug(slug)) {
    return {
      status: "error",
      message:
        "Slug inválido. Use 3 a 80 caracteres: letras minúsculas, números e hífens.",
    };
  }

  const dataInicioVotacao = parseLocalDateTime(inicioRaw);
  const dataFimVotacao = parseLocalDateTime(fimRaw);

  if (!dataInicioVotacao || !dataFimVotacao) {
    return {
      status: "error",
      message: "Informe as datas de início e fim da votação.",
    };
  }
  if (dataFimVotacao <= dataInicioVotacao) {
    return {
      status: "error",
      message: "A data/hora de fim deve ser posterior à de início.",
    };
  }

  try {
    await prisma.workplace.create({
      data: {
        nome,
        zona: zona as Zona,
        orgao,
        linkToken: slug,
        // Usa ESTRITAMENTE o pleito recebido do contexto da sidebar.
        anoEleicao,
        dataInicioVotacao,
        dataFimVotacao,
        voteLimit,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        status: "error",
        message: `O slug "${slug}" já está em uso nesta eleição. Escolha outro.`,
      };
    }
    console.error("Erro ao criar local:", error);
    return { status: "error", message: "Erro ao criar o local de trabalho." };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/locais");
  return {
    status: "success",
    message: `Local criado. Link público: /votacao/${slug}`,
  };
}

export async function updateSlug(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "").trim();
  const slug = slugify(String(formData.get("slug") ?? "").trim());

  if (!id) return { status: "error", message: "Local inválido." };
  if (!isValidSlug(slug)) {
    return {
      status: "error",
      message:
        "Slug inválido. Use 3 a 80 caracteres: letras minúsculas, números e hífens.",
    };
  }

  try {
    await prisma.workplace.update({
      where: { id },
      data: { linkToken: slug },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        status: "error",
        message: `O slug "${slug}" já está em uso nesta eleição. Escolha outro.`,
      };
    }
    console.error("Erro ao atualizar slug:", error);
    return { status: "error", message: "Erro ao atualizar o link." };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/locais");
  revalidatePath(`/admin/locais/${id}`);
  return { status: "success", message: "Link atualizado." };
}

export async function updateWorkplaceSchedule(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "").trim();
  const inicioRaw = String(formData.get("dataInicioVotacao") ?? "");
  const fimRaw = String(formData.get("dataFimVotacao") ?? "");

  if (!id) {
    return { status: "error", message: "Local inválido." };
  }

  const dataInicioVotacao = parseLocalDateTime(inicioRaw);
  const dataFimVotacao = parseLocalDateTime(fimRaw);

  if (!dataInicioVotacao || !dataFimVotacao) {
    return { status: "error", message: "Informe as datas de início e fim." };
  }
  if (dataFimVotacao <= dataInicioVotacao) {
    return {
      status: "error",
      message: "A data/hora de fim deve ser posterior à de início.",
    };
  }

  try {
    await prisma.workplace.update({
      where: { id },
      data: { dataInicioVotacao, dataFimVotacao },
    });
  } catch (error) {
    console.error("Erro ao atualizar horário:", error);
    return { status: "error", message: "Erro ao atualizar o horário." };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/locais");
  revalidatePath(`/admin/locais/${id}`);
  return { status: "success", message: "Horário atualizado." };
}

/** Define ou remove o limite de votos do local (vazio = ilimitado). */
export async function updateVoteLimit(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { status: "error", message: "Local inválido." };

  const voteLimit = parseVoteLimit(formData.get("voteLimit"));
  if (voteLimit === "invalid") {
    return {
      status: "error",
      message: "Limite de votos inválido. Use um número inteiro ≥ 1.",
    };
  }

  // Não permite definir um limite menor que os votos já registrados.
  if (voteLimit !== null) {
    const total = await prisma.vote.count({ where: { workplaceId: id } });
    if (voteLimit < total) {
      return {
        status: "error",
        message: `O limite (${voteLimit}) não pode ser menor que os ${total} votos já registrados.`,
      };
    }
  }

  try {
    await prisma.workplace.update({ where: { id }, data: { voteLimit } });
  } catch (error) {
    console.error("Erro ao atualizar limite:", error);
    return { status: "error", message: "Erro ao atualizar o limite de votos." };
  }

  revalidatePath("/admin/locais");
  revalidatePath(`/admin/locais/${id}`);
  return {
    status: "success",
    message:
      voteLimit === null
        ? "Limite removido (ilimitado)."
        : `Limite definido em ${voteLimit} votos.`,
  };
}

/** Encerra a votação manualmente AGORA, mesmo antes do horário previsto. */
export async function encerrarVotacao(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  const workplace = await prisma.workplace.findUnique({ where: { id } });
  if (!workplace) return;

  // Define o fim 1s no passado para garantir status "encerrada".
  const fim = new Date(Date.now() - 1000);
  const inicio =
    workplace.dataInicioVotacao < fim ? workplace.dataInicioVotacao : fim;

  await prisma.workplace.update({
    where: { id },
    data: { dataInicioVotacao: inicio, dataFimVotacao: fim },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/locais");
  revalidatePath(`/admin/locais/${id}`);
}

/** Reabre uma votação encerrada definindo um novo horário de término futuro. */
export async function reopenWorkplace(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "").trim();
  const novoFimRaw = String(formData.get("novoFim") ?? "");

  if (!id) return { status: "error", message: "Local inválido." };

  const novoFim = parseLocalDateTime(novoFimRaw);
  if (!novoFim) {
    return { status: "error", message: "Informe o novo horário de término." };
  }
  if (novoFim <= new Date()) {
    return {
      status: "error",
      message: "O novo término deve ser no futuro para reabrir a votação.",
    };
  }

  const workplace = await prisma.workplace.findUnique({ where: { id } });
  if (!workplace) {
    return { status: "error", message: "Local não encontrado." };
  }

  // Mantém o início original; se o início ainda for futuro, antecipa para agora.
  const novoInicio =
    workplace.dataInicioVotacao > new Date()
      ? new Date()
      : workplace.dataInicioVotacao;

  try {
    await prisma.workplace.update({
      where: { id },
      data: { dataInicioVotacao: novoInicio, dataFimVotacao: novoFim },
    });
  } catch (error) {
    console.error("Erro ao reabrir votação:", error);
    return { status: "error", message: "Erro ao reabrir a votação." };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/locais");
  revalidatePath(`/admin/locais/${id}`);
  return { status: "success", message: "Votação reaberta com sucesso." };
}

/* -------------------------------------------------------------------------- */
/*                                 Candidatos                                  */
/* -------------------------------------------------------------------------- */

export async function createCandidate(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const nome = String(formData.get("nome") ?? "").trim();
  const workplaceId = String(formData.get("workplaceId") ?? "").trim();

  if (!workplaceId) {
    return { status: "error", message: "Local de trabalho inválido." };
  }
  if (!nome) {
    return { status: "error", message: "Informe o nome do candidato." };
  }

  try {
    await prisma.candidate.create({
      data: { nome, workplaceId },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return { status: "error", message: "Local de trabalho não encontrado." };
    }
    console.error("Erro ao criar candidato:", error);
    return { status: "error", message: "Erro ao cadastrar o candidato." };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/locais");
  revalidatePath(`/admin/locais/${workplaceId}`);
  return { status: "success", message: "Candidato cadastrado com sucesso." };
}

// Tamanho máximo de cada lote enviado pelo cliente (sem limite total).
// (Não pode ser exportado: módulos "use server" só exportam funções async.)
const IMPORT_CHUNK_MAX = 1000;

/**
 * Importa um LOTE de candidatos (já parseados no cliente).
 * O cliente fatia a lista em lotes e chama esta action várias vezes,
 * acompanhando o progresso — assim não há limite total e nenhuma requisição
 * fica pesada. Cada lote é inserido com prisma.candidate.createMany.
 *
 * `isLast` revalida os caches apenas no fim, evitando overhead por lote.
 */
export async function importCandidatesChunk(
  workplaceId: string,
  nomes: string[],
  isLast: boolean,
): Promise<{ status: "ok" | "error"; count: number; message?: string }> {
  if (!workplaceId) {
    return { status: "error", count: 0, message: "Local de trabalho inválido." };
  }
  if (!Array.isArray(nomes)) {
    return { status: "error", count: 0, message: "Lote inválido." };
  }
  if (nomes.length > IMPORT_CHUNK_MAX) {
    return {
      status: "error",
      count: 0,
      message: `Lote excede o máximo de ${IMPORT_CHUNK_MAX} por requisição.`,
    };
  }

  const data = nomes
    .map((n) => String(n ?? "").trim().slice(0, 120))
    .filter((n) => n.length > 0)
    .map((nome) => ({ nome, workplaceId }));

  if (data.length === 0) {
    return { status: "ok", count: 0 };
  }

  try {
    const result = await prisma.candidate.createMany({ data });

    if (isLast) {
      revalidatePath("/admin");
      revalidatePath("/admin/locais");
      revalidatePath(`/admin/locais/${workplaceId}`);
    }

    return { status: "ok", count: result.count };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return {
        status: "error",
        count: 0,
        message: "Local de trabalho não encontrado.",
      };
    }
    console.error("Erro ao importar lote de candidatos:", error);
    return { status: "error", count: 0, message: "Erro ao importar o lote." };
  }
}

/**
 * Remove um candidato — APENAS se ele ainda não recebeu votos.
 * Candidatos com votos não podem ser excluídos (integridade da apuração).
 */
export async function deleteCandidate(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { status: "error", message: "Candidato inválido." };

  const candidate = await prisma.candidate.findUnique({
    where: { id },
    include: { _count: { select: { votes: true } } },
  });

  if (!candidate) {
    return { status: "error", message: "Candidato não encontrado." };
  }
  if (candidate._count.votes > 0) {
    return {
      status: "error",
      message:
        "Não é possível excluir: este candidato já possui votos registrados.",
    };
  }

  await prisma.candidate.delete({ where: { id } });

  revalidatePath("/admin");
  revalidatePath("/admin/locais");
  revalidatePath(`/admin/locais/${candidate.workplaceId}`);
  return { status: "success", message: "Candidato removido." };
}

/* -------------------------------------------------------------------------- */
/*                       Exportação de votantes (CSV)                          */
/* -------------------------------------------------------------------------- */

const CSV_EXPORT_LIMIT = 50000;

/**
 * Exporta os votantes filtrados em CSV (campanhas de filiação).
 * Respeita o sigilo do voto: exporta apenas dados do eleitor, nunca a escolha.
 * Usa a MESMA cláusula where da listagem (buildVoterWhere).
 */
export async function exportVotersCsv(filtros: VoterFiltros): Promise<string> {
  const where = buildVoterWhere(filtros);

  const voters = await prisma.voter.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: CSV_EXPORT_LIMIT,
    select: {
      nome: true,
      telefone: true,
      email: true,
      isFiliado: true,
      createdAt: true,
      workplace: { select: { nome: true, orgao: true, zona: true } },
    },
  });

  const header = [
    "Nome",
    "Telefone",
    "Email",
    "Filiacao",
    "Orgao",
    "Local",
    "Zona",
    "Data/Hora",
  ];
  const linhas = voters.map((v) => [
    v.nome,
    v.telefone ?? "",
    v.email ?? "",
    v.isFiliado ? "Filiado" : "Nao filiado",
    v.workplace.orgao,
    v.workplace.nome,
    v.workplace.zona,
    formatDateTime(v.createdAt),
  ]);

  const esc = (campo: string) => `"${String(campo).replace(/"/g, '""')}"`;
  const corpo = [header, ...linhas]
    .map((linha) => linha.map(esc).join(";"))
    .join("\r\n");

  // BOM (﻿) para o Excel reconhecer UTF-8 e exibir os acentos.
  return `﻿${corpo}`;
}

/* -------------------------------------------------------------------------- */
/*                          Exclusão de Locais                                 */
/* -------------------------------------------------------------------------- */

/**
 * Exclui um Local de Trabalho e TUDO que depende dele.
 *
 * O onDelete: Cascade do schema remove em cascata, na mesma transação do banco,
 * os candidatos, os votos e os votantes deste local. O `linkToken` (link
 * público) é um campo do próprio Workplace, então some junto — a URL pública
 * passa a retornar 404 e o slug fica livre para reuso.
 *
 * Segurança:
 *  - Local SEM votos: exclui direto (confirmação simples no modal).
 *  - Local COM votos: exige digitar o NOME EXATO do local como confirmação
 *    (validado também aqui no servidor, não só no cliente).
 */
export async function deleteWorkplace(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "").trim();
  const confirmacao = String(formData.get("confirmacao") ?? "").trim();

  if (!id) return { status: "error", message: "Local inválido." };

  const workplace = await prisma.workplace.findUnique({
    where: { id },
    select: { id: true, nome: true, _count: { select: { votes: true } } },
  });
  if (!workplace) {
    return { status: "error", message: "Local não encontrado." };
  }

  // Com votos computados, a exclusão exige a frase de confirmação (nome exato).
  if (workplace._count.votes > 0 && confirmacao !== workplace.nome.trim()) {
    return {
      status: "error",
      message:
        "Confirmação inválida. Digite o nome exato do local para excluir definitivamente.",
    };
  }

  try {
    // Cascade: candidatos + votos + votantes são removidos junto com o local.
    await prisma.workplace.delete({ where: { id } });
  } catch (error) {
    console.error("Erro ao excluir local:", error);
    return { status: "error", message: "Erro ao excluir o local de trabalho." };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/locais");
  // redirect lança internamente (NEXT_REDIRECT) — fora do try/catch acima.
  redirect("/admin/locais");
}
