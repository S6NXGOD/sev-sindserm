"use server";

import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isValidCpf, maskCpf, normalizeCpf } from "@/lib/cpf";
import { formatDateTime } from "@/lib/format";
import { getCurrentElectionYear, getElectionLogos } from "@/lib/election";
import { normalizeForSearch } from "@/lib/slug";
import { votingStatus } from "@/lib/voting-status";
import type { VoteActionState } from "@/lib/types";

// Sentinela para sinalizar "limite atingido" de dentro da transação.
class VoteLimitReachedError extends Error {}

function gerarProtocolo(): string {
  // Ex.: SEV-3F9A2B7C10 (não revela o voto; serve só para o comprovante)
  return `SEV-${randomBytes(5).toString("hex").toUpperCase()}`;
}

/**
 * Server Action de votação pública.
 *
 * Fluxo:
 *  1. Localiza o Local de Trabalho pelo linkToken.
 *  2. Valida se a data/hora atual está dentro da janela de votação.
 *  3. Valida os dados do formulário (inclui aceite LGPD e CPF).
 *  4. Em uma transação:
 *       - (se houver) verifica o limite de votos do local;
 *       - cria o registro em Voter (cpf/matricula @unique = barreira anti-duplicidade);
 *       - cria o registro em Vote de forma ANÔNIMA (sem nenhuma relação com Voter).
 *  5. Em caso de P2002 (Unique Constraint) em cpf/matricula:
 *     "Voto já registrado para este CPF ou Matrícula".
 *  6. Retorna o comprovante (protocolo + dados) para download em PDF.
 */
export async function castVote(
  _prevState: VoteActionState,
  formData: FormData,
): Promise<VoteActionState> {
  const linkToken = String(formData.get("linkToken") ?? "").trim();

  if (!linkToken) {
    return { status: "error", message: "Link de votação inválido." };
  }

  // A votação pública sempre se refere à eleição VIGENTE (isolamento por ano).
  const anoEleicao = getCurrentElectionYear();

  // 0. TRAVA DE SEGURANÇA DO PLEITO: só vota se o pleito estiver ATIVO e dentro
  // da janela geral (independente da janela de cada local).
  // `ano` não é único (pode haver eleições especiais no mesmo ano): a votação
  // pública usa o pleito REGULAR do ano (isEleicaoEspecial = false primeiro).
  const pleito = await prisma.election.findFirst({
    where: { ano: anoEleicao },
    orderBy: [{ isEleicaoEspecial: "asc" }, { createdAt: "asc" }],
    select: { status: true, dataInicioGeral: true, dataFimGeral: true },
  });
  if (!pleito || pleito.status !== "ATIVO") {
    return {
      status: "error",
      message: "A votação não está disponível para este pleito no momento.",
    };
  }
  {
    const agora = new Date();
    if (pleito.dataInicioGeral && agora < pleito.dataInicioGeral) {
      return {
        status: "error",
        message: "O período de votação do pleito ainda não começou.",
      };
    }
    if (pleito.dataFimGeral && agora > pleito.dataFimGeral) {
      return {
        status: "error",
        message: "O período de votação do pleito já foi encerrado.",
      };
    }
  }

  // Carrega APENAS os dados do local — nunca a lista de candidatos (pode ter
  // milhares). A validação do candidato é feita por consulta direcionada abaixo.
  const workplace = await prisma.workplace.findFirst({
    where: { linkToken, anoEleicao },
    select: {
      id: true,
      nome: true,
      orgao: true,
      zona: true,
      voteLimit: true,
      dataInicioVotacao: true,
      dataFimVotacao: true,
    },
  });

  if (!workplace) {
    return { status: "error", message: "Local de votação não encontrado." };
  }

  // 2. Validação da janela de votação (data/hora atual).
  // TRAVA DE SERVIDOR: vale mesmo que alguém poste direto, sem passar pela tela.
  const agora = new Date();
  const status = votingStatus(
    workplace.dataInicioVotacao,
    workplace.dataFimVotacao,
    agora,
  );
  if (status === "undefined") {
    return {
      status: "error",
      message:
        "A votação para este local ainda não foi agendada. Aguarde a visita da diretoria do SINDSERM.",
    };
  }
  if (status === "upcoming") {
    return {
      status: "error",
      message: "A votação ainda não foi iniciada para este local.",
    };
  }
  if (status === "closed") {
    return {
      status: "error",
      message: "A votação está encerrada para este local.",
    };
  }

  // 3. Coleta e validação dos campos
  const nome = String(formData.get("nome") ?? "").trim();
  const cpfRaw = String(formData.get("cpf") ?? "");
  const telefone = String(formData.get("telefone") ?? "").trim();
  const matricula = String(formData.get("matricula") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const candidateId = String(formData.get("candidateId") ?? "").trim();
  const filiacao = String(formData.get("isFiliado") ?? "").trim();
  const aceiteLgpd = formData.get("aceiteLgpd");

  const cpf = normalizeCpf(cpfRaw);

  if (!nome) {
    return { status: "error", message: "Informe o nome completo." };
  }
  if (!isValidCpf(cpf)) {
    return { status: "error", message: "CPF inválido. Verifique os dígitos." };
  }
  if (!matricula) {
    return { status: "error", message: "Informe a Matrícula da Prefeitura." };
  }
  if (!candidateId) {
    return { status: "error", message: "Selecione um candidato." };
  }
  if (filiacao !== "sim" && filiacao !== "nao") {
    return {
      status: "error",
      message: "Informe se você é filiado ao SINDSERM.",
    };
  }

  // O candidato escolhido deve pertencer ao Local de Trabalho do link.
  // Consulta direcionada (índice em workplaceId) — não carrega a lista inteira.
  const candidato = await prisma.candidate.findFirst({
    where: { id: candidateId, workplaceId: workplace.id },
    select: { id: true },
  });
  if (!candidato) {
    return {
      status: "error",
      message: "Candidato inválido para este local de votação.",
    };
  }

  if (aceiteLgpd !== "on" && aceiteLgpd !== "true") {
    return {
      status: "error",
      message:
        "É necessário aceitar o tratamento de dados pessoais (LGPD) para votar.",
    };
  }

  const protocolo = gerarProtocolo();

  // 4. Persistência: Voter + Vote em transação (sem FK entre eles -> sigilo).
  try {
    await prisma.$transaction(async (tx) => {
      // 4a. Limite de votos do local (null = ilimitado).
      if (workplace.voteLimit !== null) {
        const total = await tx.vote.count({
          where: { workplaceId: workplace.id },
        });
        if (total >= workplace.voteLimit) {
          throw new VoteLimitReachedError();
        }
      }

      // 4b. Eleitor: a checagem de unicidade é POR ano (cpf+ano / matricula+ano).
      // workplaceId registra apenas ONDE votou (comparecimento), nunca EM QUEM.
      await tx.voter.create({
        data: {
          nome,
          cpf,
          telefone: telefone || null,
          matricula,
          email: email || null,
          workplaceId: workplace.id,
          anoEleicao,
          isFiliado: filiacao === "sim",
          protocolo,
        },
      });

      // 4c. Voto, de forma ANÔNIMA (nenhuma referência ao eleitor).
      await tx.vote.create({
        data: {
          candidateId,
          workplaceId: workplace.id,
          anoEleicao,
        },
      });
    });
  } catch (error) {
    if (error instanceof VoteLimitReachedError) {
      return {
        status: "error",
        message: "Este local de votação atingiu o limite de votos.",
      };
    }
    // 5. Restrição única (CPF ou Matrícula) => voto já registrado.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        status: "error",
        message: "Voto já registrado para este CPF ou Matrícula",
      };
    }

    console.error("Erro ao registrar voto:", error);
    return {
      status: "error",
      message: "Erro ao registrar o voto. Tente novamente em instantes.",
    };
  }

  // 6. Comprovante (sem informação do candidato escolhido — sigilo preservado).
  const logos = await getElectionLogos(anoEleicao);
  return {
    status: "success",
    message: "Voto registrado com sucesso. Obrigado por participar!",
    receipt: {
      protocolo,
      nome,
      cpfMascarado: maskCpf(cpf),
      matricula,
      local: workplace.nome,
      orgao: workplace.orgao,
      zona: workplace.zona,
      dataHora: formatDateTime(new Date()),
      // Regra estrita: SINDSERM sempre presente (com default); pleito pode ser null.
      logoSindsermUrl: logos.sindserm,
      logoPleitoUrl: logos.pleito,
    },
  };
}

export type CandidateOption = { id: string; nome: string };

/**
 * Busca assíncrona de candidatos para o autocomplete público.
 * Recebe o linkToken do local + termo de busca e devolve no máximo 20
 * candidatos. A busca é ACENTO- e MAIÚSCULAS/MINÚSCULAS-insensível ("João"
 * casa com "JOAO"). NUNCA devolve a lista inteira ao cliente.
 */
export async function searchCandidates(
  linkToken: string,
  search: string,
): Promise<CandidateOption[]> {
  const token = (linkToken ?? "").trim();
  if (!token) return [];

  const workplace = await prisma.workplace.findFirst({
    where: { linkToken: token, anoEleicao: getCurrentElectionYear() },
    select: { id: true },
  });
  if (!workplace) return [];

  const termo = normalizeForSearch(search ?? "");

  // Sem termo: devolve os 20 primeiros (ordem alfabética).
  if (!termo) {
    return prisma.candidate.findMany({
      where: { workplaceId: workplace.id },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
      take: 20,
    });
  }

  // Com termo: o `contains` do Postgres é case-insensitive mas NÃO ignora
  // acentos ("João" não casaria com "JOAO"). Por isso carregamos os candidatos
  // do local (universo de UM local) e filtramos em memória com o mesmo
  // normalizador (acento- e caixa-insensível). Leve mesmo com milhares de nomes.
  const candidatos = await prisma.candidate.findMany({
    where: { workplaceId: workplace.id },
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
  });

  const resultado: CandidateOption[] = [];
  for (const c of candidatos) {
    if (normalizeForSearch(c.nome).includes(termo)) {
      resultado.push(c);
      if (resultado.length >= 20) break;
    }
  }
  return resultado;
}
