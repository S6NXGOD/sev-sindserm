"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma, Zona } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ORGAOS, ZONAS } from "@/lib/constants";
import { isValidSlug, searchScore, searchTokens, slugify } from "@/lib/slug";
import { VOTING_STATUS_ASCII, votingStatus } from "@/lib/voting-status";
import { ensureModule, getCurrentUser, guard } from "@/lib/current-user";
import { registrarAuditoria } from "@/lib/audit";
import { registrarEventoLocal, registrarEventoLocalSafe } from "@/lib/eventos";
import { notificarAdminsBg } from "@/lib/push";
import { formatDateTime } from "@/lib/format";
import { buildVoterWhere, type VoterFiltros } from "@/lib/voter-filters";
import { apurarEleitos, calcularVagas } from "@/lib/vagas";
import { apurarLocal } from "@/lib/apuracao";
import { DEFAULT_LOGO } from "@/lib/logo-constants";
import type { ActionState } from "@/lib/types";

function parseLocalDateTime(value: string): Date | null {
  if (!value) return null;
  // <input datetime-local> não carrega fuso. Interpretamos SEMPRE como horário
  // de Brasília (UTC-3): o servidor (Railway) roda em UTC, então usar new Date()
  // direto deslocaria as horas em 3h. (Brasil sem horário de verão desde 2019.)
  const m = value.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/);
  const date = new Date(m ? `${m[1]}:00-03:00` : value);
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
// Órgão é LISTA FIXA (não se cadastra órgão novo): só valores da lista oficial.
const ORGAO_VALUES = ORGAOS as readonly string[];

/* -------------------------------------------------------------------------- */
/*                              Locais de Trabalho                             */
/* -------------------------------------------------------------------------- */

export async function createWorkplace(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const g = await guard("locais", "EDIT");
  if ("error" in g) return { status: "error", message: g.error };

  const nome = String(formData.get("nome") ?? "").trim();
  const zona = String(formData.get("zona") ?? "").trim();
  const orgao = String(formData.get("orgao") ?? "").trim();
  const slugInput = String(formData.get("slug") ?? "").trim();
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

  // NOVA REGRA: o local NÃO herda mais as datas do pleito. Ele NASCE SEM JANELA
  // (dataInicio/dataFim = null => status "Não definida"), e a diretoria agenda a
  // votação depois, na tela do local (updateWorkplaceSchedule), ao visitá-lo.

  // Candidatos (OPCIONAL): lista de nomes enviada pelo formulário como JSON.
  // Vazia/ausente => cria só o local. O cadastro de candidatos é 100% opcional.
  let candidatos: string[] = [];
  const candidatosRaw = String(formData.get("candidatos") ?? "").trim();
  if (candidatosRaw) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(candidatosRaw);
    } catch {
      return { status: "error", message: "Lista de candidatos inválida." };
    }
    if (!Array.isArray(parsed)) {
      return { status: "error", message: "Lista de candidatos inválida." };
    }
    // NÃO deduplica: homônimos são candidatos distintos. Só remove vazios.
    candidatos = parsed
      .map((n) => String(n ?? "").trim().slice(0, 120))
      .filter((n) => n.length > 0);
  }
  const MAX_CANDIDATOS = 5000;
  if (candidatos.length > MAX_CANDIDATOS) {
    return {
      status: "error",
      message: `Máximo de ${MAX_CANDIDATOS} candidatos por cadastro. Para listas maiores, crie o local e use a importação por CSV na tela do local.`,
    };
  }

  try {
    // TRANSAÇÃO (tudo-ou-nada): cria o local e, havendo candidatos, insere-os em
    // LOTE amarrados ao novo ID. Se a inserção falhar, o local não é criado.
    await prisma.$transaction(
      async (tx) => {
        const workplace = await tx.workplace.create({
          data: {
            nome,
            zona: zona as Zona,
            orgao,
            linkToken: slug,
            // Usa ESTRITAMENTE o pleito recebido do contexto da sidebar.
            anoEleicao,
            // Sem janela: "Aguardando Diretoria" até o agendamento manual.
            dataInicioVotacao: null,
            dataFimVotacao: null,
            voteLimit,
            // Rastro: quem criou este local (foto/nome aparecem no próprio local).
            criadoPorId: g.user.id,
            criadoPorNome: g.user.nome,
          },
        });
        if (candidatos.length > 0) {
          await tx.candidate.createMany({
            data: candidatos.map((nome) => ({ nome, workplaceId: workplace.id })),
          });
        }
      },
      { timeout: 20000 },
    );
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
  await registrarAuditoria("CRIOU_LOCAL", {
    alvo: nome,
    detalhe:
      candidatos.length > 0 ? `${candidatos.length} candidato(s)` : undefined,
    user: g.user,
  });
  return {
    status: "success",
    message:
      candidatos.length > 0
        ? `Local criado com ${candidatos.length} candidato(s). Link público: /votacao/${slug}`
        : `Local criado. Link público: /votacao/${slug}`,
  };
}

export type WorkplaceOption = { id: string; nome: string };

/**
 * Busca de locais para autocomplete (filtros de Votantes/Relatórios). Devolve
 * no máximo `limit` (teto 50), ACENTO- e caixa-insensível. Carrega os locais do
 * ano e filtra em memória (universo pequeno por pleito) — mesmo padrão do
 * searchCandidates. NUNCA devolve a lista inteira de uma vez ao cliente.
 */
export async function searchWorkplacesLite(
  anoEleicao: number,
  search: string,
  limit = 20,
): Promise<WorkplaceOption[]> {
  // Usada por vários módulos (locais/relatórios/votantes) — exige apenas sessão.
  if (!(await getCurrentUser())) return [];
  if (!Number.isInteger(anoEleicao)) return [];
  const take = Math.min(Math.max(Math.trunc(limit) || 20, 1), 50);
  const tokens = searchTokens(search ?? "");

  const locais = await prisma.workplace.findMany({
    where: { anoEleicao },
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
  });

  if (tokens.length === 0) return locais.slice(0, take);

  // Casa por tokens (acento/caixa/pontuação-insensível, qualquer ordem) e
  // ranqueia — o mais relevante vem primeiro, mesmo com o teto `take`.
  const scored: Array<{ l: WorkplaceOption; score: number }> = [];
  for (const l of locais) {
    const score = searchScore(l.nome, tokens);
    if (score > 0) scored.push({ l, score });
  }
  scored.sort(
    (a, b) => b.score - a.score || a.l.nome.localeCompare(b.l.nome, "pt"),
  );
  return scored.slice(0, take).map((s) => s.l);
}

export async function updateSlug(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const g = await guard("locais", "EDIT");
  if ("error" in g) return { status: "error", message: g.error };

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
  await registrarAuditoria("ALTEROU_LINK", {
    alvo: slug,
    detalhe: "link público do local",
    user: g.user,
  });
  return { status: "success", message: "Link atualizado." };
}

/**
 * Atualiza os DADOS CADASTRAIS do local (nome, órgão, zona). O ano do pleito
 * (anoEleicao) NÃO é editável aqui — mudá-lo moveria o local entre pleitos. O
 * link (slug), os horários e o limite têm suas próprias ações.
 */
export async function updateWorkplace(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const g = await guard("locais", "EDIT");
  if ("error" in g) return { status: "error", message: g.error };

  const id = String(formData.get("id") ?? "").trim();
  const nome = String(formData.get("nome") ?? "").trim();
  const zona = String(formData.get("zona") ?? "").trim();
  const orgao = String(formData.get("orgao") ?? "").trim();

  if (!id) return { status: "error", message: "Local inválido." };
  if (!nome) {
    return { status: "error", message: "Informe o nome do local de trabalho." };
  }
  if (!ZONA_VALUES.includes(zona)) {
    return { status: "error", message: "Selecione uma zona válida." };
  }
  if (!ORGAO_VALUES.includes(orgao)) {
    return { status: "error", message: "Selecione um órgão válido da lista." };
  }

  try {
    await prisma.workplace.update({
      where: { id },
      data: { nome, zona: zona as Zona, orgao },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return { status: "error", message: "Local de trabalho não encontrado." };
    }
    console.error("Erro ao atualizar o local:", error);
    return { status: "error", message: "Erro ao atualizar o local de trabalho." };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/locais");
  revalidatePath(`/admin/locais/${id}`);
  await registrarAuditoria("EDITOU_LOCAL", {
    alvo: nome,
    detalhe: `${orgao} · ${zona}`,
    user: g.user,
  });
  return { status: "success", message: "Dados do local atualizados." };
}

export async function updateWorkplaceSchedule(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const g = await guard("locais", "EDIT");
  if ("error" in g) return { status: "error", message: g.error };

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

  // Aviso (não bloqueia): agendar um local SEM candidatos deixa a urna abrir
  // mostrando "sem candidatos" — vexatório. A UI já alerta; aqui reforçamos.
  const semCandidatos =
    (await prisma.candidate.count({ where: { workplaceId: id } })) === 0;

  let wp: { nome: string; anoEleicao: number; rodadaAtual: number };
  try {
    wp = await prisma.workplace.update({
      where: { id },
      // Nova janela → reseta os controles de notificação por tempo (o cron
      // volta a avisar "vai começar"/"encerrou" para as novas datas).
      data: {
        dataInicioVotacao,
        dataFimVotacao,
        notifStartSent: false,
        notifCloseSent: false,
        notifEndingSoonSent: false,
        // Rastro: quem agendou e quando (mostrado no próprio local).
        agendadoPorId: g.user.id,
        agendadoPorNome: g.user.nome,
        agendadoEm: new Date(),
      },
      select: { nome: true, anoEleicao: true, rodadaAtual: true },
    });
  } catch (error) {
    console.error("Erro ao atualizar horário:", error);
    return { status: "error", message: "Erro ao atualizar o horário." };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/locais");
  revalidatePath(`/admin/locais/${id}`);
  await registrarAuditoria("AGENDOU_VOTACAO", {
    alvo: wp.nome,
    detalhe: `${formatDateTime(dataInicioVotacao)} até ${formatDateTime(dataFimVotacao)}`,
    user: g.user,
  });
  await registrarEventoLocalSafe(prisma, {
    workplaceId: id,
    anoEleicao: wp.anoEleicao,
    rodada: wp.rodadaAtual,
    tipo: "AGENDAMENTO",
    titulo: "Votação agendada",
    detalhe: `De ${formatDateTime(dataInicioVotacao)} até ${formatDateTime(dataFimVotacao)}.`,
    autorNome: g.user.nome,
  });
  // Notifica a diretoria (menos quem agendou) — inclui QUEM agendou.
  notificarAdminsBg(
    {
      title: "🗓️ Votação agendada",
      body: `${g.user.nome} agendou "${wp.nome}" para ${formatDateTime(dataInicioVotacao)}.`,
      url: `/admin/locais/${id}`,
      tag: `agenda-${id}`,
    },
    { exceptUserId: g.user.id },
  );
  // Alerta acionável: agendado SEM candidatos (evita o vexame na urna).
  if (semCandidatos) {
    notificarAdminsBg(
      {
        title: "📣 Agendado SEM candidatos",
        body: `Atenção: "${wp.nome}" foi agendado, mas não tem candidatos cadastrados.`,
        url: `/admin/locais/${id}`,
        tag: `semcand-${id}`,
      },
      { exceptUserId: g.user.id },
    );
  }
  return semCandidatos
    ? {
        status: "warning",
        message:
          "Horário salvo — ATENÇÃO: este local não tem candidatos cadastrados. A urna abrirá mostrando 'sem candidatos'.",
      }
    : { status: "success", message: "Horário atualizado." };
}

/** Define ou remove o limite de votos do local (vazio = ilimitado). */
export async function updateVoteLimit(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const g = await guard("locais", "EDIT");
  if ("error" in g) return { status: "error", message: g.error };

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { status: "error", message: "Local inválido." };

  const voteLimit = parseVoteLimit(formData.get("voteLimit"));
  if (voteLimit === "invalid") {
    return {
      status: "error",
      message: "Limite de votos inválido. Use um número inteiro ≥ 1.",
    };
  }

  // Não permite definir um limite menor que os votos já registrados. O limite
  // vale POR RODADA (é assim que a votação o aplica), então conta a rodada atual.
  if (voteLimit !== null) {
    const wpLim = await prisma.workplace.findUnique({
      where: { id },
      select: { rodadaAtual: true },
    });
    const total = await prisma.vote.count({
      where: { workplaceId: id, rodada: wpLim?.rodadaAtual ?? 1 },
    });
    if (voteLimit < total) {
      return {
        status: "error",
        message: `O limite (${voteLimit}) não pode ser menor que os ${total} votos já registrados.`,
      };
    }
  }

  let localLimite: { nome: string } | null = null;
  try {
    localLimite = await prisma.workplace.update({
      where: { id },
      data: { voteLimit },
      select: { nome: true },
    });
  } catch (error) {
    console.error("Erro ao atualizar limite:", error);
    return { status: "error", message: "Erro ao atualizar o limite de votos." };
  }

  revalidatePath("/admin/locais");
  revalidatePath(`/admin/locais/${id}`);
  await registrarAuditoria("DEFINIU_LIMITE", {
    alvo: localLimite?.nome ?? "local",
    detalhe: voteLimit === null ? "ilimitado" : `limite de ${voteLimit} votos`,
    user: g.user,
  });
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
  const g = await guard("locais", "EDIT");
  if ("error" in g) return;

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  const workplace = await prisma.workplace.findUnique({ where: { id } });
  if (!workplace) return;

  // Define o fim 1s no passado para garantir status "encerrada".
  // Local sem janela agendada (datas null): usa o próprio `fim` como início, para
  // que o encerramento manual funcione mesmo em local "Não definido".
  const fim = new Date(Date.now() - 1000);
  const inicio =
    workplace.dataInicioVotacao && workplace.dataInicioVotacao < fim
      ? workplace.dataInicioVotacao
      : fim;

  await prisma.workplace.update({
    where: { id },
    // notifCloseSent=true: encerramento MANUAL já notifica aqui; o cron não
    // deve re-notificar este local como "encerrado automaticamente".
    data: {
      dataInicioVotacao: inicio,
      dataFimVotacao: fim,
      notifCloseSent: true,
      // Rastro: quem encerrou e quando.
      encerradoPorId: g.user.id,
      encerradoPorNome: g.user.nome,
      encerradoEm: new Date(),
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/locais");
  revalidatePath(`/admin/locais/${id}`);
  await registrarAuditoria("ENCERROU", { alvo: workplace.nome, user: g.user });
  // Linha do tempo pública: encerramento manual desta rodada.
  await registrarEventoLocalSafe(prisma, {
    workplaceId: id,
    anoEleicao: workplace.anoEleicao,
    rodada: workplace.rodadaAtual,
    tipo: "ENCERRAMENTO",
    titulo:
      workplace.rodadaAtual > 1
        ? `Votação da ${workplace.rodadaAtual}ª rodada encerrada`
        : "Votação encerrada",
    detalhe: "Encerramento manual pela diretoria.",
    autorNome: g.user.nome,
  });

  // Apura para avisar de forma ACIONÁVEL: empate (precisa desempate) ou vaga
  // vazia (precisa suplementar) têm prioridade sobre o aviso comum.
  const apur = await apurarLocal(id);
  let notif;
  if (apur.temEmpate) {
    notif = {
      title: "⚖️ Encerrou com EMPATE",
      body: `"${workplace.nome}" foi encerrada por ${g.user.nome} e há EMPATE na linha de corte — precisa de desempate.`,
    };
  } else if (apur.vagasVazias > 0) {
    notif = {
      title: "🟠 Encerrou com vaga vazia",
      body: `"${workplace.nome}" encerrou com ${apur.vagasVazias} vaga(s) sem eleito. Avalie suplementação.`,
    };
  } else {
    notif = {
      title: "🔒 Votação encerrada",
      body: `${g.user.nome} encerrou "${workplace.nome}".`,
    };
  }
  notificarAdminsBg(
    { ...notif, url: `/admin/locais/${id}`, tag: `fim-${id}` },
    { exceptUserId: g.user.id },
  );
}

/** Reabre uma votação encerrada definindo um novo horário de término futuro. */
export async function reopenWorkplace(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const g = await guard("locais", "EDIT");
  if ("error" in g) return { status: "error", message: g.error };

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

  // Mantém o início original; se não houver início (null) ou ele ainda for
  // futuro, antecipa para agora — a votação passa a aceitar votos já.
  const agora = new Date();
  const novoInicio =
    !workplace.dataInicioVotacao || workplace.dataInicioVotacao > agora
      ? agora
      : workplace.dataInicioVotacao;

  try {
    await prisma.workplace.update({
      where: { id },
      // Reaberta → o cron volta a poder notificar o próximo encerramento.
      data: {
        dataInicioVotacao: novoInicio,
        dataFimVotacao: novoFim,
        notifCloseSent: false,
        notifEndingSoonSent: false,
        // Reabrir zera a decisão de "manter assim" (nova votação em andamento).
        vagasVaziasAceitas: false,
        // Reabrir é um novo agendamento; limpa o rastro de encerramento.
        agendadoPorId: g.user.id,
        agendadoPorNome: g.user.nome,
        agendadoEm: new Date(),
        encerradoPorId: null,
        encerradoPorNome: null,
        encerradoEm: null,
      },
    });
  } catch (error) {
    console.error("Erro ao reabrir votação:", error);
    return { status: "error", message: "Erro ao reabrir a votação." };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/locais");
  revalidatePath(`/admin/locais/${id}`);
  await registrarAuditoria("REABRIU", {
    alvo: workplace.nome,
    detalhe: `novo término ${formatDateTime(novoFim)}`,
    user: g.user,
  });
  await registrarEventoLocalSafe(prisma, {
    workplaceId: id,
    anoEleicao: workplace.anoEleicao,
    rodada: workplace.rodadaAtual,
    tipo: "REABERTURA",
    titulo: "Votação reaberta",
    detalhe: `Novo término em ${formatDateTime(novoFim)}.`,
    autorNome: g.user.nome,
  });
  notificarAdminsBg(
    {
      title: "🔓 Votação reaberta",
      body: `${g.user.nome} reabriu "${workplace.nome}" até ${formatDateTime(novoFim)}.`,
      url: `/admin/locais/${id}`,
      tag: `fim-${id}`,
    },
    { exceptUserId: g.user.id },
  );
  return { status: "success", message: "Votação reaberta com sucesso." };
}

/**
 * Decisão da diretoria sobre um local encerrado com VAGAS SEM ELEITO:
 *  - aceito=true  → "Manter assim": finaliza sem suplementar (some do painel).
 *  - aceito=false → reabre a decisão (volta a aparecer no painel).
 * Vaga vazia costuma ser natural (menos candidatos/votos que vagas). Registrado
 * na auditoria; reversível.
 */
export async function setVagasVaziasAceitas(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const g = await guard("locais", "EDIT");
  if ("error" in g) return { status: "error", message: g.error };

  const id = String(formData.get("id") ?? "").trim();
  const aceito = String(formData.get("aceito") ?? "") === "true";
  if (!id) return { status: "error", message: "Local inválido." };

  const wp = await prisma.workplace.findUnique({
    where: { id },
    select: { nome: true },
  });
  if (!wp) return { status: "error", message: "Local não encontrado." };

  await prisma.workplace.update({
    where: { id },
    data: { vagasVaziasAceitas: aceito },
  });
  revalidatePath("/admin/encerradas");
  revalidatePath(`/admin/locais/${id}`);
  await registrarAuditoria(
    aceito ? "ACEITOU_VAGAS_VAZIAS" : "REVERTEU_VAGAS_VAZIAS",
    { alvo: wp.nome, user: g.user },
  );
  return {
    status: "success",
    message: aceito
      ? `"${wp.nome}" finalizado sem suplementar.`
      : `"${wp.nome}" voltou para a lista de decisão.`,
  };
}

/**
 * DISPENSA (opt-out) de um local: a diretoria declara que ele NÃO terá
 * representação (não será visitado / os servidores optaram por não ter
 * representante do sindicato ali). O local sai das pendências/alertas e não
 * recebe votos. Reversível; registrado na auditoria e na linha do tempo.
 */
export async function setSemRepresentacao(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const g = await guard("locais", "EDIT");
  if ("error" in g) return { status: "error", message: g.error };

  const id = String(formData.get("id") ?? "").trim();
  const dispensar = String(formData.get("dispensar") ?? "") === "true";
  const motivo = String(formData.get("motivo") ?? "").trim().slice(0, 300);
  if (!id) return { status: "error", message: "Local inválido." };

  const wp = await prisma.workplace.findUnique({
    where: { id },
    select: { nome: true, anoEleicao: true, rodadaAtual: true },
  });
  if (!wp) return { status: "error", message: "Local não encontrado." };

  await prisma.workplace.update({
    where: { id },
    data: {
      semRepresentacao: dispensar,
      semRepresentacaoMotivo: dispensar ? motivo || null : null,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/locais");
  revalidatePath(`/admin/locais/${id}`);
  revalidatePath("/admin/encerradas");
  await registrarAuditoria(
    dispensar ? "DISPENSOU_LOCAL" : "REVERTEU_DISPENSA",
    { alvo: wp.nome, detalhe: dispensar ? motivo || undefined : undefined, user: g.user },
  );
  await registrarEventoLocalSafe(prisma, {
    workplaceId: id,
    anoEleicao: wp.anoEleicao,
    rodada: wp.rodadaAtual,
    tipo: "DISPENSA",
    titulo: dispensar
      ? "Local dispensado (sem representação)"
      : "Dispensa revertida",
    detalhe: dispensar
      ? motivo
        ? `Motivo: ${motivo}`
        : "Sem motivo informado."
      : "O local volta ao processo normal.",
    autorNome: g.user.nome,
  });

  return {
    status: "success",
    message: dispensar
      ? `"${wp.nome}" marcado como SEM representação.`
      : `"${wp.nome}" voltou ao processo normal.`,
  };
}

/**
 * Prévia da suplementar: mostra à diretoria QUEM seria preservado (eleitos da
 * rodada atual, travados) e QUANTAS vagas ficariam para a nova rodada — ANTES
 * de confirmar. Só leitura; não altera nada. Local precisa estar ENCERRADO.
 */
export type SuplementarPreview = {
  ok: boolean;
  motivo?: string;
  nome: string;
  rodadaAtual: number;
  vagas: number;
  preservados: { nome: string; votos: number }[];
  vagasRestantes: number;
  temEmpate: boolean;
};

export async function previewSuplementar(
  id: string,
): Promise<SuplementarPreview> {
  await ensureModule("locais", "VIEW");

  const vazio: SuplementarPreview = {
    ok: false,
    nome: "",
    rodadaAtual: 1,
    vagas: 0,
    preservados: [],
    vagasRestantes: 0,
    temEmpate: false,
  };

  const wp = await prisma.workplace.findUnique({
    where: { id },
    select: {
      nome: true,
      rodadaAtual: true,
      dataInicioVotacao: true,
      dataFimVotacao: true,
    },
  });
  if (!wp) return { ...vazio, motivo: "Local não encontrado." };

  const status = votingStatus(
    wp.dataInicioVotacao,
    wp.dataFimVotacao,
    new Date(),
  );
  if (status !== "closed") {
    return {
      ...vazio,
      nome: wp.nome,
      rodadaAtual: wp.rodadaAtual,
      motivo: "A votação precisa estar ENCERRADA para abrir uma suplementar.",
    };
  }

  const apur = await apurarLocal(id);
  const preservados = apur.eleitos.map((e) => ({ nome: e.nome, votos: e.votos }));
  return {
    ok: !apur.temEmpate,
    motivo: apur.temEmpate
      ? "Há EMPATE na linha de corte — resolva o desempate (renúncia) antes de preservar os eleitos."
      : undefined,
    nome: wp.nome,
    rodadaAtual: wp.rodadaAtual,
    vagas: apur.vagas,
    preservados,
    vagasRestantes: Math.max(0, apur.vagas - preservados.length),
    temEmpate: apur.temEmpate,
  };
}

/**
 * Abre uma ELEIÇÃO SUPLEMENTAR (nova rodada) num local ENCERRADO.
 *
 * Dois modos:
 *  - "suplementar" (padrão): PRESERVA os eleitos da rodada atual (travados como
 *    `eleitoPreservado`, guardando `preservadoVotos`); eles NÃO aparecem na
 *    cédula da nova rodada. Só concorrem os NÃO eleitos, disputando as vagas
 *    restantes ("dar oportunidade a mais gente").
 *  - "zero": NOVA eleição do zero — ninguém é preservado (todos concorrem de
 *    novo). Zera qualquer preservação anterior.
 *
 * Em ambos: incrementa `rodadaAtual` (isola votos/votantes da nova rodada, sem
 * apagar os anteriores), agenda a nova janela e limpa o rastro de encerramento.
 */
export async function iniciarSuplementar(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const g = await guard("locais", "EDIT");
  if ("error" in g) return { status: "error", message: g.error };

  const id = String(formData.get("id") ?? "").trim();
  const modo = String(formData.get("modo") ?? "suplementar").trim();
  const novoInicioRaw = String(formData.get("novoInicio") ?? "");
  const novoFimRaw = String(formData.get("novoFim") ?? "");
  // Motivo público da suplementar (ata/decisão) — aparece na transparência.
  const motivo = String(formData.get("motivo") ?? "").trim().slice(0, 500);

  if (!id) return { status: "error", message: "Local inválido." };
  if (modo !== "suplementar" && modo !== "zero") {
    return { status: "error", message: "Modo de suplementar inválido." };
  }

  const novoFim = parseLocalDateTime(novoFimRaw);
  if (!novoFim) {
    return { status: "error", message: "Informe o término da nova rodada." };
  }
  if (novoFim <= new Date()) {
    return {
      status: "error",
      message: "O término da nova rodada deve ser no futuro.",
    };
  }
  // Início opcional: vazio = começa agora.
  const novoInicio = novoInicioRaw ? parseLocalDateTime(novoInicioRaw) : new Date();
  if (!novoInicio) {
    return { status: "error", message: "Data de início inválida." };
  }
  if (novoFim <= novoInicio) {
    return {
      status: "error",
      message: "O término deve ser depois do início da nova rodada.",
    };
  }

  const workplace = await prisma.workplace.findUnique({
    where: { id },
    select: {
      nome: true,
      anoEleicao: true,
      rodadaAtual: true,
      dataInicioVotacao: true,
      dataFimVotacao: true,
    },
  });
  if (!workplace) return { status: "error", message: "Local não encontrado." };

  // TRAVA: só se abre suplementar sobre uma rodada JÁ ENCERRADA.
  const status = votingStatus(
    workplace.dataInicioVotacao,
    workplace.dataFimVotacao,
    new Date(),
  );
  if (status !== "closed") {
    return {
      status: "error",
      message: "Encerre a votação atual antes de abrir a suplementar.",
    };
  }

  // Apura a rodada atual para saber QUEM preservar (modo suplementar).
  const apur = await apurarLocal(id);
  if (modo === "suplementar") {
    if (apur.temEmpate) {
      return {
        status: "error",
        message:
          "Há empate na linha de corte. Resolva o desempate (renúncia) antes de preservar os eleitos.",
      };
    }
    const vagasRestantes = Math.max(0, apur.vagas - apur.eleitos.length);
    if (vagasRestantes <= 0) {
      return {
        status: "error",
        message:
          "Não há vagas restantes (todas preenchidas). Para recomeçar, use “Nova eleição do zero”.",
      };
    }
  }

  const novaRodada = workplace.rodadaAtual + 1;
  const rodadaEncerrada = workplace.rodadaAtual;
  const eleitosIds = apur.eleitos.map((e) => e.id);

  // SNAPSHOT da rodada que está sendo encerrada (arquivo p/ auditoria retroativa
  // e "cartão de resultado" de cada rodada na transparência). Reconciliação POR
  // rodada: comparecimento x votos daquela rodada.
  const [votantesRodada, votosRodada, preservadosAntes] = await Promise.all([
    prisma.voter.count({ where: { workplaceId: id, rodada: rodadaEncerrada } }),
    prisma.vote.count({ where: { workplaceId: id, rodada: rodadaEncerrada } }),
    prisma.candidate.findMany({
      where: { workplaceId: id, eleitoPreservado: true },
      select: { id: true },
    }),
  ]);
  const preservadoIds = new Set(preservadosAntes.map((c) => c.id));
  const snapshot = {
    vagas: apur.vagas,
    votantes: votantesRodada,
    votos: votosRodada,
    confere: votantesRodada === votosRodada,
    eleitos: apur.eleitos.map((e) => ({
      nome: e.nome,
      votos: e.votos,
      preservado: preservadoIds.has(e.id),
    })),
  };

  try {
    await prisma.$transaction(async (tx) => {
      if (modo === "suplementar") {
        // Trava os eleitos atuais como PRESERVADOS (não concorrem de novo) e
        // grava os votos com que foram eleitos (exibição na transparência).
        for (const e of apur.eleitos) {
          await tx.candidate.update({
            where: { id: e.id },
            data: { eleitoPreservado: true, preservadoVotos: e.votos },
          });
        }
      } else {
        // Nova eleição do zero: ninguém preservado (todos concorrem de novo).
        await tx.candidate.updateMany({
          where: { workplaceId: id },
          data: { eleitoPreservado: false, preservadoVotos: null },
        });
      }

      await tx.workplace.update({
        where: { id },
        data: {
          rodadaAtual: novaRodada,
          dataInicioVotacao: novoInicio,
          dataFimVotacao: novoFim,
          // Nova rodada em andamento: o cron volta a notificar início/fim.
          notifStartSent: false,
          notifCloseSent: false,
          notifEndingSoonSent: false,
          vagasVaziasAceitas: false,
          agendadoPorId: g.user.id,
          agendadoPorNome: g.user.nome,
          agendadoEm: new Date(),
          encerradoPorId: null,
          encerradoPorNome: null,
          encerradoEm: null,
        },
      });

      // LINHA DO TEMPO: arquiva o resultado da rodada encerrada + registra a
      // abertura da suplementar (com o motivo público, quando informado).
      await registrarEventoLocal(tx, {
        workplaceId: id,
        anoEleicao: workplace.anoEleicao,
        rodada: rodadaEncerrada,
        tipo: "RODADA_ENCERRADA",
        titulo: `Resultado da ${rodadaEncerrada}ª rodada arquivado`,
        detalhe: `${snapshot.eleitos.length} eleito(s) · ${snapshot.votantes} votante(s)`,
        autorNome: g.user.nome,
        snapshot,
      });
      await registrarEventoLocal(tx, {
        workplaceId: id,
        anoEleicao: workplace.anoEleicao,
        rodada: novaRodada,
        tipo: "SUPLEMENTAR",
        titulo:
          modo === "suplementar"
            ? `${novaRodada}ª rodada (suplementar) aberta`
            : `${novaRodada}ª rodada (nova eleição do zero) aberta`,
        detalhe:
          (modo === "suplementar"
            ? `${eleitosIds.length} eleito(s) preservado(s). `
            : "Todos os candidatos concorrem novamente. ") +
          (motivo ? `Motivo: ${motivo}` : "Sem motivo informado."),
        autorNome: g.user.nome,
      });
    });
  } catch (error) {
    console.error("Erro ao iniciar suplementar:", error);
    return { status: "error", message: "Erro ao iniciar a eleição suplementar." };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/locais");
  revalidatePath(`/admin/locais/${id}`);
  revalidatePath("/admin/encerradas");

  // Detalhe da auditoria com a JANELA COMPLETA (início até fim) — não só o término.
  const janelaTxt = `de ${formatDateTime(novoInicio)} até ${formatDateTime(novoFim)}`;
  const detalhe =
    modo === "suplementar"
      ? `rodada ${novaRodada} · ${eleitosIds.length} eleito(s) preservado(s) · ${janelaTxt}`
      : `rodada ${novaRodada} · nova eleição do zero · ${janelaTxt}`;
  await registrarAuditoria("INICIOU_SUPLEMENTAR", {
    alvo: workplace.nome,
    detalhe,
    user: g.user,
  });
  notificarAdminsBg(
    {
      title: "🗳️ Eleição suplementar aberta",
      body: `${g.user.nome} abriu a ${novaRodada}ª rodada em "${workplace.nome}" até ${formatDateTime(novoFim)}.`,
      url: `/admin/locais/${id}`,
      tag: `fim-${id}`,
    },
    { exceptUserId: g.user.id },
  );

  return {
    status: "success",
    message:
      modo === "suplementar"
        ? `Suplementar aberta: ${eleitosIds.length} eleito(s) preservado(s), nova rodada em andamento.`
        : "Nova eleição do zero aberta: todos os candidatos concorrem novamente.",
  };
}

/* -------------------------------------------------------------------------- */
/*                                 Candidatos                                  */
/* -------------------------------------------------------------------------- */

export async function createCandidate(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const g = await guard("locais", "EDIT");
  if ("error" in g) return { status: "error", message: g.error };

  const nome = String(formData.get("nome") ?? "").trim();
  const workplaceId = String(formData.get("workplaceId") ?? "").trim();

  if (!workplaceId) {
    return { status: "error", message: "Local de trabalho inválido." };
  }
  if (!nome) {
    return { status: "error", message: "Informe o nome do candidato." };
  }

  let local: { nome: string } | null = null;
  try {
    await prisma.candidate.create({
      data: { nome, workplaceId },
    });
    local = await prisma.workplace.findUnique({
      where: { id: workplaceId },
      select: { nome: true },
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
  await registrarAuditoria("ADICIONOU_CANDIDATO", {
    alvo: nome,
    detalhe: local ? `no local "${local.nome}"` : undefined,
    user: g.user,
  });
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
  const g = await guard("locais", "EDIT");
  if ("error" in g) {
    return { status: "error", count: 0, message: g.error };
  }
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
      // Audita UMA vez (no fim do lote), com o total de candidatos do local.
      const [local, total] = await Promise.all([
        prisma.workplace.findUnique({
          where: { id: workplaceId },
          select: { nome: true },
        }),
        prisma.candidate.count({ where: { workplaceId } }),
      ]);
      await registrarAuditoria("IMPORTOU_CANDIDATOS", {
        alvo: local?.nome ?? "local",
        detalhe: `importação concluída — ${total} candidato(s) no local`,
        user: g.user,
      });
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
  const g = await guard("locais", "EDIT");
  if ("error" in g) return { status: "error", message: g.error };

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
  await registrarAuditoria("EXCLUIU_CANDIDATO", {
    alvo: candidate.nome,
    user: g.user,
  });
  return { status: "success", message: "Candidato removido." };
}

/** Motivos válidos para um candidato NÃO assumir a vaga. */
const RENUNCIA_MOTIVOS = new Set([
  "Renúncia",
  "Desistência",
  "Desempate",
  "Inelegibilidade",
  "Outro",
]);

/**
 * Registra (ou desfaz) que um candidato NÃO ASSUME A VAGA — renúncia,
 * desistência, perda em desempate ou inelegibilidade. Ao marcar, a apuração
 * promove automaticamente o próximo suplente (recalculada a cada leitura).
 * Guarda o motivo para a ata/auditoria.
 */
export async function setCandidateRenuncia(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const g = await guard("locais", "EDIT");
  if ("error" in g) return { status: "error", message: g.error };

  const id = String(formData.get("id") ?? "").trim();
  const renunciou = String(formData.get("renunciou") ?? "") === "true";
  const motivoRaw = String(formData.get("motivo") ?? "").trim();
  const motivo = RENUNCIA_MOTIVOS.has(motivoRaw) ? motivoRaw : "Renúncia";

  if (!id) return { status: "error", message: "Candidato inválido." };

  const candidate = await prisma.candidate.findUnique({
    where: { id },
    select: {
      workplaceId: true,
      nome: true,
      workplace: { select: { anoEleicao: true, rodadaAtual: true } },
    },
  });
  if (!candidate) {
    return { status: "error", message: "Candidato não encontrado." };
  }

  await prisma.candidate.update({
    where: { id },
    data: {
      renunciou,
      renunciaMotivo: renunciou ? motivo : null,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/locais");
  revalidatePath(`/admin/locais/${candidate.workplaceId}`);
  revalidatePath("/admin/encerradas");
  revalidatePath("/admin/relatorios");
  await registrarAuditoria(renunciou ? "RENUNCIA" : "REVERTEU_RENUNCIA", {
    alvo: candidate.nome,
    detalhe: renunciou ? motivo : undefined,
    user: g.user,
  });
  // Linha do tempo pública: quem não assume a vaga (com o motivo) e reversões.
  await registrarEventoLocalSafe(prisma, {
    workplaceId: candidate.workplaceId,
    anoEleicao: candidate.workplace.anoEleicao,
    rodada: candidate.workplace.rodadaAtual,
    tipo: "RENUNCIA",
    titulo: renunciou
      ? `${candidate.nome} não assume a vaga`
      : `${candidate.nome} voltou à disputa`,
    detalhe: renunciou ? `Motivo: ${motivo}. Suplente promovido.` : "Renúncia revertida.",
    autorNome: g.user.nome,
  });
  notificarAdminsBg(
    {
      title: renunciou ? "⚖️ Não assume a vaga" : "↩️ Renúncia revertida",
      body: renunciou
        ? `${g.user.nome} registrou que ${candidate.nome} não assume a vaga (${motivo}). Suplente promovido.`
        : `${g.user.nome} reverteu: ${candidate.nome} voltou à disputa.`,
      url: `/admin/locais/${candidate.workplaceId}`,
      tag: `renuncia-${id}`,
    },
    { exceptUserId: g.user.id },
  );
  return {
    status: "success",
    message: renunciou
      ? `${candidate.nome} não assume a vaga (${motivo}). Suplente promovido.`
      : `${candidate.nome} voltou à disputa da vaga.`,
  };
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
  await ensureModule("votantes", "VIEW"); // dados pessoais — nunca sem permissão
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

const REPORT_ROW_CAP = 50000;
const CSV_ESC = (campo: string) => `"${String(campo).replace(/"/g, '""')}"`;
const toCsv = (rows: string[][]) =>
  `﻿${rows.map((r) => r.map(CSV_ESC).join(";")).join("\r\n")}`;

/** Rótulo ASCII do status (CSV/PDF). Inclui "Nao definida" (datas null). */
function statusPt(inicio: Date | null, fim: Date | null, now: Date): string {
  return VOTING_STATUS_ASCII[votingStatus(inicio, fim, now)];
}

export type LocaisReportOpts = {
  anoEleicao: number;
  zona?: string;
  orgao?: string;
  localId?: string;
  status?: string; // "open" | "closed" | "upcoming"
  incluirFiliados?: boolean;
  somenteFiliados?: boolean;
  incluirCandidatos?: boolean;
};

/**
 * RELATÓRIO DINÂMICO DE LOCAIS (CSV): filtros cruzados (zona/órgão/status/local)
 * + opção de anexar VOTANTES (todos ou só filiados) e/ou CANDIDATOS de cada
 * local, unificados numa só planilha (coluna "Tipo"). Uso: organização interna
 * da diretoria (ex.: visitar todos os locais de uma zona e ter os filiados).
 */
export async function exportLocaisReport(
  opts: LocaisReportOpts,
): Promise<string> {
  await ensureModule("relatorios", "VIEW");
  const now = new Date();
  const where: Prisma.WorkplaceWhereInput = { anoEleicao: opts.anoEleicao };
  if (opts.localId) where.id = opts.localId;
  if (opts.orgao) where.orgao = opts.orgao;
  if (opts.zona) where.zona = opts.zona as Zona;

  let locais = await prisma.workplace.findMany({
    where,
    orderBy: [{ orgao: "asc" }, { zona: "asc" }, { nome: "asc" }],
    select: {
      id: true,
      nome: true,
      orgao: true,
      zona: true,
      dataInicioVotacao: true,
      dataFimVotacao: true,
    },
  });
  if (opts.status) {
    locais = locais.filter(
      (l) =>
        votingStatus(l.dataInicioVotacao, l.dataFimVotacao, now) === opts.status,
    );
  }
  const ids = locais.map((l) => l.id);

  const votersByLocal = new Map<
    string,
    { nome: string; telefone: string | null; email: string | null; isFiliado: boolean }[]
  >();
  const candsByLocal = new Map<string, string[]>();

  if (opts.incluirFiliados && ids.length) {
    const voters = await prisma.voter.findMany({
      where: {
        workplaceId: { in: ids },
        ...(opts.somenteFiliados ? { isFiliado: true } : {}),
      },
      orderBy: { nome: "asc" },
      take: REPORT_ROW_CAP,
      select: {
        nome: true,
        telefone: true,
        email: true,
        isFiliado: true,
        workplaceId: true,
      },
    });
    for (const v of voters) {
      const arr = votersByLocal.get(v.workplaceId) ?? [];
      arr.push(v);
      votersByLocal.set(v.workplaceId, arr);
    }
  }
  if (opts.incluirCandidatos && ids.length) {
    const cands = await prisma.candidate.findMany({
      where: { workplaceId: { in: ids } },
      orderBy: { nome: "asc" },
      take: REPORT_ROW_CAP,
      select: { nome: true, workplaceId: true },
    });
    for (const c of cands) {
      const arr = candsByLocal.get(c.workplaceId) ?? [];
      arr.push(c.nome);
      candsByLocal.set(c.workplaceId, arr);
    }
  }

  const header = [
    "Local",
    "Orgao",
    "Zona",
    "Status",
    "Tipo",
    "Nome",
    "Telefone",
    "Email",
    "Filiado",
  ];
  const linhas: string[][] = [];
  for (const l of locais) {
    const status = statusPt(l.dataInicioVotacao, l.dataFimVotacao, now);
    let emitidas = 0;
    if (opts.incluirFiliados) {
      for (const v of votersByLocal.get(l.id) ?? []) {
        if (linhas.length >= REPORT_ROW_CAP) break;
        linhas.push([
          l.nome,
          l.orgao,
          l.zona,
          status,
          "Votante",
          v.nome,
          v.telefone ?? "",
          v.email ?? "",
          v.isFiliado ? "Sim" : "Nao",
        ]);
        emitidas++;
      }
    }
    if (opts.incluirCandidatos) {
      for (const nome of candsByLocal.get(l.id) ?? []) {
        if (linhas.length >= REPORT_ROW_CAP) break;
        linhas.push([l.nome, l.orgao, l.zona, status, "Candidato", nome, "", "", ""]);
        emitidas++;
      }
    }
    if (emitidas === 0) {
      linhas.push([l.nome, l.orgao, l.zona, status, "Local", "", "", "", ""]);
    }
  }

  return toCsv([header, ...linhas]);
}

export type LocaisReportLocal = {
  nome: string;
  orgao: string;
  zona: string;
  status: string;
  votantes: {
    nome: string;
    telefone: string;
    email: string;
    isFiliado: boolean;
  }[];
  candidatos: string[];
};
export type LocaisReportData = {
  geradoEm: string;
  filtros: string;
  incluiFiliados: boolean;
  somenteFiliados: boolean;
  incluiCandidatos: boolean;
  logoSindserm: string;
  totalLocais: number;
  totalVotantes: number;
  totalCandidatos: number;
  truncado: boolean;
  locais: LocaisReportLocal[];
};

// Teto de linhas RENDERIZADAS no PDF (o CSV continua completo, sem corte).
const PDF_ROW_CAP = 4000;

/**
 * Mesmos filtros/opções do relatório de locais, porém devolvendo os dados
 * ESTRUTURADOS (agrupados por local) + a logo do SINDSERM do pleito, para o
 * cliente montar o PDF personalizado.
 */
export async function getLocaisReportData(
  opts: LocaisReportOpts,
): Promise<LocaisReportData> {
  await ensureModule("relatorios", "VIEW");
  const now = new Date();
  const where: Prisma.WorkplaceWhereInput = { anoEleicao: opts.anoEleicao };
  if (opts.localId) where.id = opts.localId;
  if (opts.orgao) where.orgao = opts.orgao;
  if (opts.zona) where.zona = opts.zona as Zona;

  let locais = await prisma.workplace.findMany({
    where,
    orderBy: [{ orgao: "asc" }, { zona: "asc" }, { nome: "asc" }],
    select: {
      id: true,
      nome: true,
      orgao: true,
      zona: true,
      dataInicioVotacao: true,
      dataFimVotacao: true,
    },
  });
  if (opts.status) {
    locais = locais.filter(
      (l) =>
        votingStatus(l.dataInicioVotacao, l.dataFimVotacao, now) === opts.status,
    );
  }
  const ids = locais.map((l) => l.id);

  const votersByLocal = new Map<string, LocaisReportLocal["votantes"]>();
  const candsByLocal = new Map<string, string[]>();

  if (opts.incluirFiliados && ids.length) {
    const voters = await prisma.voter.findMany({
      where: {
        workplaceId: { in: ids },
        ...(opts.somenteFiliados ? { isFiliado: true } : {}),
      },
      orderBy: { nome: "asc" },
      take: PDF_ROW_CAP,
      select: {
        nome: true,
        telefone: true,
        email: true,
        isFiliado: true,
        workplaceId: true,
      },
    });
    for (const v of voters) {
      const arr = votersByLocal.get(v.workplaceId) ?? [];
      arr.push({
        nome: v.nome,
        telefone: v.telefone ?? "",
        email: v.email ?? "",
        isFiliado: v.isFiliado,
      });
      votersByLocal.set(v.workplaceId, arr);
    }
  }
  if (opts.incluirCandidatos && ids.length) {
    const cands = await prisma.candidate.findMany({
      where: { workplaceId: { in: ids } },
      orderBy: { nome: "asc" },
      take: PDF_ROW_CAP,
      select: { nome: true, workplaceId: true },
    });
    for (const c of cands) {
      const arr = candsByLocal.get(c.workplaceId) ?? [];
      arr.push(c.nome);
      candsByLocal.set(c.workplaceId, arr);
    }
  }

  let usados = 0;
  let truncado = false;
  let totalVotantes = 0;
  let totalCandidatos = 0;
  const out: LocaisReportLocal[] = [];
  for (const l of locais) {
    const votantes = opts.incluirFiliados ? (votersByLocal.get(l.id) ?? []) : [];
    const candidatos = opts.incluirCandidatos
      ? (candsByLocal.get(l.id) ?? [])
      : [];
    totalVotantes += votantes.length;
    totalCandidatos += candidatos.length;

    const vCorte = votantes.slice(0, Math.max(0, PDF_ROW_CAP - usados));
    usados += vCorte.length;
    const cCorte = candidatos.slice(0, Math.max(0, PDF_ROW_CAP - usados));
    usados += cCorte.length;
    if (vCorte.length < votantes.length || cCorte.length < candidatos.length) {
      truncado = true;
    }

    out.push({
      nome: l.nome,
      orgao: l.orgao,
      zona: l.zona,
      status: statusPt(l.dataInicioVotacao, l.dataFimVotacao, now),
      votantes: vCorte,
      candidatos: cCorte,
    });
  }

  const pleito = await prisma.election.findFirst({
    where: { ano: opts.anoEleicao },
    orderBy: [{ isEleicaoEspecial: "asc" }, { createdAt: "asc" }],
    select: { logoSindsermUrl: true },
  });

  const statusTxt: Record<string, string> = {
    open: "Em andamento",
    closed: "Encerradas",
    upcoming: "Não iniciadas",
  };
  const filtrosArr: string[] = [];
  if (opts.localId && out.length === 1) filtrosArr.push(`Local: ${out[0].nome}`);
  if (opts.zona) filtrosArr.push(`Zona: ${opts.zona}`);
  if (opts.orgao) filtrosArr.push(`Órgão: ${opts.orgao}`);
  if (opts.status) filtrosArr.push(`Status: ${statusTxt[opts.status] ?? opts.status}`);

  return {
    geradoEm: formatDateTime(now),
    filtros: filtrosArr.length ? filtrosArr.join(" · ") : "Todos os locais",
    incluiFiliados: !!opts.incluirFiliados,
    somenteFiliados: !!opts.somenteFiliados,
    incluiCandidatos: !!opts.incluirCandidatos,
    logoSindserm: pleito?.logoSindsermUrl ?? DEFAULT_LOGO,
    totalLocais: out.length,
    totalVotantes,
    totalCandidatos,
    truncado,
    locais: out,
  };
}

/**
 * RELATÓRIO DEFINITIVO DE ELEITOS (CSV): varre os locais ENCERRADOS do pleito
 * (com filtros opcionais), apura os vencedores pelo nº de vagas de cada local
 * (via ROW_NUMBER no banco — sem teto) e consolida os novos representantes.
 */
export async function exportEleitosCsv(opts: {
  anoEleicao: number;
  zona?: string;
  orgao?: string;
  localId?: string;
}): Promise<string> {
  await ensureModule("encerradas", "VIEW");
  const now = new Date();
  const header = ["Orgao", "Zona", "Local", "Posicao", "Eleito", "Votos"];

  const where: Prisma.WorkplaceWhereInput = { anoEleicao: opts.anoEleicao };
  if (opts.localId) where.id = opts.localId;
  if (opts.orgao) where.orgao = opts.orgao;
  if (opts.zona) where.zona = opts.zona as Zona;

  const locais = await prisma.workplace.findMany({
    where,
    select: {
      id: true,
      nome: true,
      orgao: true,
      zona: true,
      dataInicioVotacao: true,
      dataFimVotacao: true,
    },
  });
  const fechados = locais.filter(
    (l) => votingStatus(l.dataInicioVotacao, l.dataFimVotacao, now) === "closed",
  );
  if (fechados.length === 0) return toCsv([header]);
  const ids = fechados.map((l) => l.id);

  const [candCounts, ranked, preservadosRaw] = await Promise.all([
    prisma.candidate.groupBy({
      by: ["workplaceId"],
      where: { workplaceId: { in: ids } },
      _count: { workplaceId: true },
    }),
    // Ranking por votos da RODADA ATUAL, EXCLUINDO renunciantes (que não assumem
    // a vaga) e eleitos preservados (contados à parte). A seleção final e o
    // desempate são resolvidos por apurarEleitos abaixo.
    prisma.$queryRaw<{ wid: string; nome: string; votos: number; rn: number }[]>(
      Prisma.sql`
        SELECT wid, nome, votos, rn::int AS rn FROM (
          SELECT v."workplaceId" AS wid, c.nome AS nome, COUNT(*)::int AS votos,
                 ROW_NUMBER() OVER (
                   PARTITION BY v."workplaceId" ORDER BY COUNT(*) DESC, c.nome ASC
                 ) AS rn
          FROM votes v
            JOIN candidates c ON c.id = v."candidateId"
            JOIN workplaces w ON w.id = v."workplaceId" AND v."rodada" = w."rodadaAtual"
          WHERE v."anoEleicao" = ${opts.anoEleicao}
            AND c."renunciou" = false
            AND c."eleitoPreservado" = false
            AND v."workplaceId" IN (${Prisma.join(ids)})
          GROUP BY v."workplaceId", c.id, c.nome
        ) t`,
    ),
    // Eleitos preservados (rodadas anteriores) — entram como eleitos definitivos.
    prisma.candidate.findMany({
      where: { workplaceId: { in: ids }, eleitoPreservado: true },
      select: { workplaceId: true, nome: true, preservadoVotos: true },
      orderBy: { preservadoVotos: "desc" },
    }),
  ]);

  const candMap = new Map(
    candCounts.map((c) => [c.workplaceId, c._count.workplaceId]),
  );
  const byLocal = new Map<string, { nome: string; votos: number; rn: number }[]>();
  for (const r of ranked) {
    const arr = byLocal.get(r.wid) ?? [];
    arr.push({ nome: r.nome, votos: Number(r.votos), rn: Number(r.rn) });
    byLocal.set(r.wid, arr);
  }
  const preservadosByLocal = new Map<string, { nome: string; votos: number }[]>();
  for (const p of preservadosRaw) {
    const arr = preservadosByLocal.get(p.workplaceId) ?? [];
    arr.push({ nome: p.nome, votos: p.preservadoVotos ?? 0 });
    preservadosByLocal.set(p.workplaceId, arr);
  }

  const linhas: string[][] = [];
  for (const l of fechados.sort(
    (a, b) => a.orgao.localeCompare(b.orgao) || a.nome.localeCompare(b.nome),
  )) {
    const vagas = calcularVagas(candMap.get(l.id) ?? 0);
    // Eleitos = preservados (travados) + eleitos da rodada atual. Apuração
    // CANÔNICA: empate na linha de corte NÃO elege por ordem de nome (aguarda
    // desempate) — o documento oficial só lista os eleitos definitivos.
    const preservados = preservadosByLocal.get(l.id) ?? [];
    const vagasRestantes = Math.max(0, vagas - preservados.length);
    const rankedLocal = (byLocal.get(l.id) ?? [])
      .sort((a, b) => a.rn - b.rn)
      .map((c) => ({ nome: c.nome, votos: c.votos, renunciou: false }));
    const apurado = apurarEleitos(rankedLocal, vagasRestantes);
    const novos = apurado.eleitos.map((c) => ({ nome: c.nome, votos: c.votos }));
    if (preservados.length + novos.length <= 0) continue;
    // Preservados primeiro, depois os eleitos da rodada atual.
    [...preservados, ...novos].forEach((c, i) => {
      if (linhas.length >= REPORT_ROW_CAP) return;
      linhas.push([l.orgao, l.zona, l.nome, String(i + 1), c.nome, String(c.votos)]);
    });
  }

  return toCsv([header, ...linhas]);
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
  const g = await guard("locais", "EDIT");
  if ("error" in g) return { status: "error", message: g.error };

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

  await registrarAuditoria("EXCLUIU_LOCAL", {
    alvo: workplace.nome,
    detalhe:
      workplace._count.votes > 0 ? `${workplace._count.votes} voto(s)` : undefined,
    user: g.user,
  });
  revalidatePath("/admin");
  revalidatePath("/admin/locais");
  // redirect lança internamente (NEXT_REDIRECT) — fora do try/catch acima.
  redirect("/admin/locais");
}
