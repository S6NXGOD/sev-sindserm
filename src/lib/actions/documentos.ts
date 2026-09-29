"use server";

import { writeFile, mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { guard } from "@/lib/current-user";
import { registrarAuditoria } from "@/lib/audit";
import {
  CATEGORIAS_DOCUMENTO,
  DOCS_PREFIX,
  MAX_DOC_BYTES,
} from "@/lib/documentos-constants";
import type { ActionState } from "@/lib/types";

// Raiz física dos PDFs. Em produção (Railway) o volume é /app/public/uploads;
// process.cwd() === "/app" → /app/public/uploads/documentos.
const DOCS_DIR = path.join(process.cwd(), "public", "uploads", "documentos");

/**
 * Transforma o título num nome de arquivo seguro (sem acentos/espaços/travessia).
 * O nome real ainda leva id + timestamp, então isto é só a parte legível.
 */
function slugArquivo(titulo: string): string {
  const base = titulo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "documento";
}

/**
 * Publica um documento oficial (ata/edital/resultado) de um pleito. Só admin com
 * permissão de Pleitos (EDIT). Aceita SOMENTE PDF: valida MIME, tamanho e os
 * magic bytes ("%PDF-"). O arquivo vai para o disco (servido por /api/uploads) e
 * os metadados para a tabela `documentos`. Registra na auditoria.
 */
export async function publicarDocumento(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const gp = await guard("pleitos", "EDIT");
  if ("error" in gp) return { status: "error", message: gp.error };

  const electionId = String(formData.get("electionId") ?? "").trim();
  const titulo = String(formData.get("titulo") ?? "").trim();
  const categoria = String(formData.get("categoria") ?? "").trim();
  const file = formData.get("arquivo");

  if (!electionId) return { status: "error", message: "Pleito inválido." };
  if (!titulo) {
    return { status: "error", message: "Informe o título do documento." };
  }
  if (titulo.length > 160) {
    return { status: "error", message: "Título muito longo (máx. 160)." };
  }
  if (!(CATEGORIAS_DOCUMENTO as readonly string[]).includes(categoria)) {
    return { status: "error", message: "Categoria inválida." };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Selecione o arquivo PDF." };
  }
  if (file.size > MAX_DOC_BYTES) {
    const mb = Math.floor(MAX_DOC_BYTES / 1_000_000);
    return { status: "error", message: `Arquivo muito grande (máx. ${mb} MB).` };
  }

  // Só PDF: confere MIME declarado E os magic bytes reais do conteúdo.
  const buf = Buffer.from(await file.arrayBuffer());
  const assinatura = buf.subarray(0, 5).toString("latin1");
  if (file.type !== "application/pdf" || assinatura !== "%PDF-") {
    return { status: "error", message: "Só é aceito arquivo PDF válido." };
  }

  const election = await prisma.election.findUnique({
    where: { id: electionId },
    select: { id: true, ano: true },
  });
  if (!election) return { status: "error", message: "Pleito não encontrado." };

  // Nome imutável e sem colisão: slug + id do pleito + timestamp.
  const filename = `${slugArquivo(titulo)}-${election.id}-${Date.now()}.pdf`;
  try {
    await mkdir(DOCS_DIR, { recursive: true });
    await writeFile(path.join(DOCS_DIR, filename), buf);
  } catch (error) {
    console.error("Erro ao salvar documento:", error);
    return { status: "error", message: "Não foi possível salvar o arquivo." };
  }

  await prisma.documento.create({
    data: {
      electionId: election.id,
      anoEleicao: election.ano,
      titulo,
      categoria,
      arquivoUrl: `${DOCS_PREFIX}${filename}`,
      tamanho: buf.byteLength,
      mime: "application/pdf",
      publicadoPorId: gp.user.id,
      publicadoPorNome: gp.user.nome,
    },
  });

  revalidatePath(`/admin/pleitos/${election.id}/editar`);
  revalidatePath("/transparencia");
  await registrarAuditoria("PUBLICOU_DOCUMENTO", {
    alvo: titulo,
    detalhe: categoria,
    user: gp.user,
  });
  return { status: "success", message: "Documento publicado." };
}

/**
 * Exclui um documento oficial (registro + arquivo do disco, best-effort).
 * Só admin com permissão de Pleitos (EDIT). Registra na auditoria.
 */
export async function excluirDocumento(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const gp = await guard("pleitos", "EDIT");
  if ("error" in gp) return { status: "error", message: gp.error };

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { status: "error", message: "Documento inválido." };

  const doc = await prisma.documento.findUnique({
    where: { id },
    select: { id: true, titulo: true, arquivoUrl: true, electionId: true },
  });
  if (!doc) return { status: "error", message: "Documento não encontrado." };

  await prisma.documento.delete({ where: { id } });

  // Best-effort: remove o PDF do disco (não falha a ação se não conseguir).
  const nome = doc.arquivoUrl.startsWith(DOCS_PREFIX)
    ? doc.arquivoUrl.slice(DOCS_PREFIX.length)
    : "";
  if (nome && !nome.includes("/") && !nome.includes("..") && !nome.includes("\\")) {
    try {
      await unlink(path.join(DOCS_DIR, nome));
    } catch {
      /* arquivo já ausente — ok */
    }
  }

  revalidatePath(`/admin/pleitos/${doc.electionId}/editar`);
  revalidatePath("/transparencia");
  await registrarAuditoria("EXCLUIU_DOCUMENTO", {
    alvo: doc.titulo,
    user: gp.user,
  });
  return { status: "success", message: "Documento excluído." };
}
