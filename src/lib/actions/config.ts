"use server";

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { Prisma, ElectionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateSlug } from "@/lib/slug";
import { DEFAULT_LOGO } from "@/lib/logo-constants";
import type { ActionState } from "@/lib/types";

/** Resolve o slug livre (anti-conflito): adiciona sufixo incremental se preciso. */
async function resolveUniqueSlug(
  titulo: string,
  ano: number,
): Promise<string> {
  const base = generateSlug(titulo, ano);
  let slug = base;
  let i = 1;
  // Busca o slug; se existir, tenta base-1, base-2, ... até achar um vago.
  while (
    await prisma.election.findUnique({ where: { slug }, select: { id: true } })
  ) {
    slug = `${base}-${i}`;
    i += 1;
  }
  return slug;
}

function parseDataLocal(value: unknown): Date | null {
  const s = String(value ?? "").trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

const ALLOWED = new Map<string, string>([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
  ["image/svg+xml", "svg"],
]);
const MAX_BYTES = 2_000_000;

// Pasta/prefixo público das logos enviadas (galeria de mídia reutilizável).
// A LISTAGEM da galeria fica em lib/system-settings.ts (listGalleryImages) —
// fonte ÚNICA; aqui ficam apenas a escrita/validação usadas pelas actions.
const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads", "logos");
const UPLOADS_PREFIX = "/uploads/logos/";
const IMG_EXT = /\.(png|jpe?g|webp|svg)$/i;

/** Verifica se uma URL aponta para uma imagem existente da galeria de uploads. */
function isValidGalleryUrl(url: string): boolean {
  if (!url.startsWith(UPLOADS_PREFIX)) return false;
  const name = url.slice(UPLOADS_PREFIX.length);
  // Sem travessia de diretório e com extensão de imagem permitida.
  return !name.includes("/") && !name.includes("..") && IMG_EXT.test(name);
}

/**
 * Validação barata (sem escrita em disco) da fonte de uma logo do FormData.
 * Retorna a mensagem de erro, ou null quando ok / quando não há fonte.
 */
function preValidateLogoSource(formData: FormData, field: string): string | null {
  const file = formData.get(field);
  if (file instanceof File && file.size > 0) {
    const v = validateLogoFile(file);
    return v.ok ? null : v.message!;
  }
  const existing = String(formData.get(`${field}Existing`) ?? "").trim();
  if (existing && !isValidGalleryUrl(existing)) {
    return "Imagem da galeria inválida.";
  }
  return null;
}

type LogoResolution =
  | { kind: "set"; url: string }
  | { kind: "clear" }
  | { kind: "keep" }
  | { kind: "error"; message: string };

/**
 * Resolve a fonte de UMA logo a partir do FormData do MediaGalleryPicker.
 * Campos: `${field}` (arquivo novo), `${field}Existing` (URL da galeria) e
 * `${field}Remove` ("1" para remover/ocultar — válido só quando permitido).
 */
async function resolveLogoField(
  formData: FormData,
  field: string,
  electionId: string,
  tipo: "sindserm" | "pleito",
  allowClear: boolean,
): Promise<LogoResolution> {
  const file = formData.get(field);
  const existing = String(formData.get(`${field}Existing`) ?? "").trim();
  const remove = String(formData.get(`${field}Remove`) ?? "") === "1";

  if (file instanceof File && file.size > 0) {
    const v = validateLogoFile(file);
    if (!v.ok) return { kind: "error", message: v.message! };
    try {
      return { kind: "set", url: await saveLogoFile(file, electionId, tipo) };
    } catch (error) {
      console.error("Erro ao salvar logo:", error);
      return { kind: "error", message: "Não foi possível salvar o arquivo." };
    }
  }

  if (existing) {
    if (!isValidGalleryUrl(existing)) {
      return { kind: "error", message: "Imagem da galeria inválida." };
    }
    return { kind: "set", url: existing };
  }

  if (remove && allowClear) return { kind: "clear" };

  return { kind: "keep" };
}

/** Valida tipo/tamanho da imagem (antes de qualquer escrita no banco/disco). */
function validateLogoFile(file: File): { ok: boolean; message?: string } {
  if (file.size > MAX_BYTES) {
    return { ok: false, message: "Imagem muito grande (máximo 2 MB)." };
  }
  if (!ALLOWED.has(file.type)) {
    return {
      ok: false,
      message: "Formato inválido. Use PNG, JPG, WEBP ou SVG.",
    };
  }
  return { ok: true };
}

/**
 * Salva o arquivo em public/uploads/logos/ com o ID do pleito no nome
 * (ex.: sindserm-<idPleito>-<timestamp>.png) — isolando por pleito — e
 * devolve a URL pública.
 */
async function saveLogoFile(
  file: File,
  electionId: string,
  tipo: "sindserm" | "pleito",
): Promise<string> {
  const ext = ALLOWED.get(file.type) ?? "png";
  const filename = `${tipo}-${electionId}-${Date.now()}.${ext}`;
  await mkdir(UPLOADS_DIR, { recursive: true });
  await writeFile(
    path.join(UPLOADS_DIR, filename),
    Buffer.from(await file.arrayBuffer()),
  );
  return `${UPLOADS_PREFIX}${filename}`;
}

/**
 * Atualiza UMA logo de um pleito existente (tela de configurações).
 * A fonte pode ser um arquivo novo, uma imagem da galeria (reuso) ou a remoção
 * da logo. Só o pleito pode ser removido (SINDSERM sempre cai no DEFAULT_LOGO).
 */
export async function uploadElectionLogo(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ano = Number(formData.get("ano"));
  const tipo = String(formData.get("tipo") ?? "");

  if (!Number.isInteger(ano) || ano < 2000) {
    return { status: "error", message: "Pleito inválido." };
  }
  if (tipo !== "sindserm" && tipo !== "pleito") {
    return { status: "error", message: "Tipo de logo inválido." };
  }

  // Garante a linha do pleito (cria se não existir) e obtém o ID.
  // `ano` não é único (pode haver eleições especiais): pega o REGULAR do ano.
  // Em criação implícita, gera um slug único (campo obrigatório).
  const existente = await prisma.election.findFirst({
    where: { ano },
    orderBy: [{ isEleicaoEspecial: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  const election =
    existente ??
    (await prisma.election.create({
      data: { ano, slug: await resolveUniqueSlug("pleito", ano) },
      select: { id: true },
    }));

  // Só o pleito admite "remover" (ocultar). O SINDSERM nunca fica sem logo.
  const resolution = await resolveLogoField(
    formData,
    "file",
    election.id,
    tipo,
    /* allowClear */ tipo === "pleito",
  );

  if (resolution.kind === "error") {
    return { status: "error", message: resolution.message };
  }
  if (resolution.kind === "keep") {
    return {
      status: "error",
      message: "Selecione uma imagem da galeria ou envie uma nova.",
    };
  }

  await prisma.election.update({
    where: { id: election.id },
    data:
      tipo === "sindserm"
        ? { logoSindsermUrl: resolution.kind === "set" ? resolution.url : null }
        : { logoPleitoUrl: resolution.kind === "set" ? resolution.url : null },
  });

  revalidatePath("/admin/configuracoes");
  revalidatePath("/admin/pleitos");
  revalidatePath("/admin", "layout");

  const nome = tipo === "sindserm" ? "do SINDSERM" : "do pleito";
  return {
    status: "success",
    message:
      resolution.kind === "clear"
        ? `Logo ${nome} removida.`
        : `Logo ${nome} atualizada.`,
  };
}

/**
 * Cria um NOVO pleito (Election) com título, ano e (opcionalmente) as duas
 * logos. Sem upload, ficam as logos genéricas padrão (fallback).
 */
export async function createElection(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const titulo = String(formData.get("titulo") ?? "").trim();
  const ano = Number(formData.get("ano"));

  // Novos campos de configuração do pleito
  const duracaoMandato = Number(formData.get("duracaoMandato"));
  const dataInicioGeral = parseDataLocal(formData.get("dataInicioGeral"));
  const dataFimGeral = parseDataLocal(formData.get("dataFimGeral"));
  const emailOficial = String(formData.get("emailOficial") ?? "").trim();
  const statusRaw = String(formData.get("status") ?? "ATIVO");
  const status =
    statusRaw in ElectionStatus
      ? (statusRaw as ElectionStatus)
      : ElectionStatus.ATIVO;
  // Checkbox "Marcar como Eleição Especial/Suplementar": quando marcada, a trava
  // anti-conflito de ano é IGNORADA (pode coexistir com o pleito regular do ano).
  const isEleicaoEspecial =
    String(formData.get("isEleicaoEspecial") ?? "") === "true";

  if (!titulo) {
    return { status: "error", message: "Informe o título do pleito." };
  }
  if (!Number.isInteger(ano) || ano < 2000 || ano > 3000) {
    return { status: "error", message: "Ano de referência inválido." };
  }
  if (!Number.isInteger(duracaoMandato) || duracaoMandato < 1 || duracaoMandato > 10) {
    return {
      status: "error",
      message: "Duração do mandato inválida (1 a 10 anos).",
    };
  }
  if (dataInicioGeral && dataFimGeral && dataFimGeral <= dataInicioGeral) {
    return {
      status: "error",
      message: "A data final do pleito deve ser posterior à inicial.",
    };
  }
  if (emailOficial && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailOficial)) {
    return { status: "error", message: "E-mail oficial inválido." };
  }

  // TRAVA ANTI-CONFLITO: no máximo 1 pleito REGULAR por ano. Eleições especiais/
  // suplementares (isEleicaoEspecial) ignoram a trava e podem coexistir.
  if (!isEleicaoEspecial) {
    const conflito = await prisma.election.findFirst({
      where: { ano, isEleicaoEspecial: false },
      select: { id: true },
    });
    if (conflito) {
      return {
        status: "error",
        message: "Conflito: Já existe um pleito regular para este ano.",
      };
    }
  }

  // Pré-valida as fontes (arquivo novo OU imagem da galeria) ANTES de criar a
  // linha, para não deixar um pleito "órfão" caso a logo seja inválida.
  const preSind = preValidateLogoSource(formData, "logoSindserm");
  if (preSind) return { status: "error", message: `Logo SINDSERM: ${preSind}` };
  const prePle = preValidateLogoSource(formData, "logoPleito");
  if (prePle) return { status: "error", message: `Logo do pleito: ${prePle}` };

  // Slug único (anti-conflito de URLs entre anos/nomes parecidos).
  const slug = await resolveUniqueSlug(titulo, ano);

  let election: { id: string };
  try {
    election = await prisma.election.create({
      data: {
        ano,
        slug,
        titulo,
        duracaoMandato,
        dataInicioGeral,
        dataFimGeral,
        emailOficial: emailOficial || null,
        status,
        isEleicaoEspecial,
      },
      select: { id: true },
    });
  } catch (error) {
    // `ano` não é mais único; P2002 aqui só ocorreria por colisão de slug (raro,
    // pois resolveUniqueSlug já garante um slug livre).
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        status: "error",
        message: "Conflito ao gerar o identificador do pleito. Tente novamente.",
      };
    }
    console.error("Erro ao criar pleito:", error);
    return { status: "error", message: "Erro ao criar o pleito." };
  }

  const updates: Prisma.ElectionUpdateInput = {};
  const rSind = await resolveLogoField(
    formData,
    "logoSindserm",
    election.id,
    "sindserm",
    /* allowClear */ false,
  );
  const rPle = await resolveLogoField(
    formData,
    "logoPleito",
    election.id,
    "pleito",
    /* allowClear */ false,
  );
  if (rSind.kind === "error" || rPle.kind === "error") {
    // O pleito foi criado; apenas as logos falharam (envia depois em Config.).
    console.error("Erro ao salvar logos do novo pleito:", { rSind, rPle });
    return {
      status: "error",
      message:
        "Pleito criado, mas não foi possível salvar as logos. Envie novamente em Configurações.",
    };
  }
  if (rSind.kind === "set") updates.logoSindsermUrl = rSind.url;
  // Regra: se NÃO for anexada uma logo do pleito no cadastro, usa a logo padrão
  // do SINDSERM (logo_default.png) — em vez de ficar sem logo.
  updates.logoPleitoUrl = rPle.kind === "set" ? rPle.url : DEFAULT_LOGO;

  await prisma.election.update({ where: { id: election.id }, data: updates });

  revalidatePath("/admin/pleitos");
  revalidatePath("/admin/configuracoes");
  revalidatePath("/admin", "layout");
  return { status: "success", message: "Pleito criado com sucesso." };
}

/**
 * Exclui um PLEITO (Election).
 *
 * Os locais/votantes/votos são ligados por ANO (anoEleicao), não por FK ao
 * pleito. Por isso:
 *  - Se este for o ÚNICO pleito do ano e houver dados, a exclusão remove também
 *    os locais do ano (cascade do banco apaga candidatos, votos e votantes) e
 *    EXIGE confirmação (digitar o ano).
 *  - Se houver OUTRO pleito no mesmo ano (ex.: eleição especial), os dados são
 *    compartilhados pelo ano e NÃO são apagados — remove-se só o registro do
 *    pleito (confirmação simples).
 */
export async function deleteElection(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "").trim();
  const confirmacao = String(formData.get("confirmacao") ?? "").trim();
  if (!id) return { status: "error", message: "Pleito inválido." };

  const election = await prisma.election.findUnique({
    where: { id },
    select: { id: true, ano: true },
  });
  if (!election) return { status: "error", message: "Pleito não encontrado." };

  const [locais, votos, outrosDoAno] = await Promise.all([
    prisma.workplace.count({ where: { anoEleicao: election.ano } }),
    prisma.vote.count({ where: { anoEleicao: election.ano } }),
    prisma.election.count({ where: { ano: election.ano, id: { not: id } } }),
  ]);

  // Só apaga os dados do ano se este for o ÚNICO pleito do ano.
  const apagaDados = outrosDoAno === 0 && (locais > 0 || votos > 0);

  if (apagaDados && confirmacao !== String(election.ano)) {
    return {
      status: "error",
      message:
        "Confirmação inválida. Digite o ano do pleito para excluir definitivamente.",
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (apagaDados) {
        // Cascade (FK do banco): candidatos, votos e votantes saem com os locais.
        await tx.workplace.deleteMany({ where: { anoEleicao: election.ano } });
      }
      await tx.election.delete({ where: { id } });
    });
  } catch (error) {
    console.error("Erro ao excluir pleito:", error);
    return { status: "error", message: "Erro ao excluir o pleito." };
  }

  revalidatePath("/admin/pleitos");
  revalidatePath("/admin", "layout");
  return {
    status: "success",
    message: apagaDados
      ? "Pleito e seus dados (locais, votos e votantes) excluídos."
      : "Pleito excluído.",
  };
}

/** Compara dois instantes (Date | null), tratando ambos nulos como iguais. */
function mesmoInstante(a: Date | null, b: Date | null): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return a.getTime() === b.getTime();
}

/**
 * EDIÇÃO CONSCIENTE de um pleito existente (tela /admin/pleitos/[id]/editar).
 * As logos têm gerência própria (Galeria de Mídia via uploadElectionLogo); aqui
 * salvamos os metadados do pleito.
 *
 * FEEDBACK DE IMPACTO: se as datas (dataInicioGeral/dataFimGeral) forem alteradas
 * e o pleito já tiver votos computados, a edição NÃO é bloqueada, mas a action
 * retorna status "warning" para a UI exibir o alerta de impacto.
 *
 * O `ano` NÃO é editável aqui (é a chave lógica que liga locais/votantes/votos);
 * por isso a trava anti-conflito na edição vale apenas ao desmarcar a eleição
 * especial (virar regular) quando já existe um pleito regular no mesmo ano.
 */
export async function updateElection(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    return { status: "error", message: "Pleito inválido." };
  }

  const atual = await prisma.election.findUnique({
    where: { id },
    select: { id: true, ano: true, dataInicioGeral: true, dataFimGeral: true },
  });
  if (!atual) {
    return { status: "error", message: "Pleito não encontrado." };
  }

  const titulo = String(formData.get("titulo") ?? "").trim();
  const duracaoMandato = Number(formData.get("duracaoMandato"));
  const dataInicioGeral = parseDataLocal(formData.get("dataInicioGeral"));
  const dataFimGeral = parseDataLocal(formData.get("dataFimGeral"));
  const emailOficial = String(formData.get("emailOficial") ?? "").trim();
  const statusRaw = String(formData.get("status") ?? "ATIVO");
  const status =
    statusRaw in ElectionStatus
      ? (statusRaw as ElectionStatus)
      : ElectionStatus.ATIVO;
  const isEleicaoEspecial =
    String(formData.get("isEleicaoEspecial") ?? "") === "true";

  if (!titulo) {
    return { status: "error", message: "Informe o título do pleito." };
  }
  if (!Number.isInteger(duracaoMandato) || duracaoMandato < 1 || duracaoMandato > 10) {
    return {
      status: "error",
      message: "Duração do mandato inválida (1 a 10 anos).",
    };
  }
  if (dataInicioGeral && dataFimGeral && dataFimGeral <= dataInicioGeral) {
    return {
      status: "error",
      message: "A data final do pleito deve ser posterior à inicial.",
    };
  }
  if (emailOficial && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailOficial)) {
    return { status: "error", message: "E-mail oficial inválido." };
  }

  // TRAVA ANTI-CONFLITO (edição): ao tornar este pleito REGULAR, não pode haver
  // OUTRO pleito regular no mesmo ano. Eleições especiais ignoram a trava.
  if (!isEleicaoEspecial) {
    const conflito = await prisma.election.findFirst({
      where: { ano: atual.ano, isEleicaoEspecial: false, id: { not: id } },
      select: { id: true },
    });
    if (conflito) {
      return {
        status: "error",
        message: "Conflito: Já existe um pleito regular para este ano.",
      };
    }
  }

  const datasAlteradas =
    !mesmoInstante(atual.dataInicioGeral, dataInicioGeral) ||
    !mesmoInstante(atual.dataFimGeral, dataFimGeral);

  await prisma.election.update({
    where: { id },
    data: {
      titulo,
      duracaoMandato,
      dataInicioGeral,
      dataFimGeral,
      emailOficial: emailOficial || null,
      status,
      isEleicaoEspecial,
    },
  });

  revalidatePath("/admin/pleitos");
  revalidatePath(`/admin/pleitos/${id}/editar`);
  revalidatePath("/admin/configuracoes");
  revalidatePath("/admin", "layout");

  // FEEDBACK DE IMPACTO: datas mexidas + votos já computados => alerta (não bloqueia).
  if (datasAlteradas) {
    const votos = await prisma.vote.count({ where: { anoEleicao: atual.ano } });
    if (votos > 0) {
      return {
        status: "warning",
        message:
          "Aviso: Datas alteradas com sucesso, mas atenção, este pleito já possui votos registrados.",
      };
    }
  }

  return { status: "success", message: "Pleito atualizado com sucesso." };
}

/**
 * Define UMA logo de um pleito a partir da Galeria de Mídia (por ID do pleito).
 * Usada pela tela de edição (ElectionLogoManager + MediaGalleryPicker): a URL
 * vem de uma imagem já existente na galeria. URL vazia REMOVE a logo (null) —
 * o pleito fica sem logo; o SINDSERM, ao exibir, cai no DEFAULT_LOGO.
 */
export async function setElectionLogo(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "").trim();
  const tipo = String(formData.get("tipo") ?? "");
  const raw = String(formData.get("url") ?? "").trim();
  const url = raw === "" ? null : raw;

  if (!id) {
    return { status: "error", message: "Pleito inválido." };
  }
  if (tipo !== "sindserm" && tipo !== "pleito") {
    return { status: "error", message: "Tipo de logo inválido." };
  }
  if (url !== null && !isValidGalleryUrl(url)) {
    return { status: "error", message: "Imagem da galeria inválida." };
  }

  const election = await prisma.election.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!election) {
    return { status: "error", message: "Pleito não encontrado." };
  }

  await prisma.election.update({
    where: { id },
    data: tipo === "sindserm" ? { logoSindsermUrl: url } : { logoPleitoUrl: url },
  });

  revalidatePath("/admin/configuracoes");
  revalidatePath("/admin/pleitos");
  revalidatePath(`/admin/pleitos/${id}/editar`);
  revalidatePath("/admin", "layout");

  const nome = tipo === "sindserm" ? "do SINDSERM" : "do pleito";
  return {
    status: "success",
    message: url ? `Logo ${nome} atualizada.` : `Logo ${nome} removida.`,
  };
}
