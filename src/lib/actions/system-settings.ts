"use server";

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { SYSTEM_SETTINGS_ID } from "@/lib/system-settings";
import type { ActionState } from "@/lib/types";

const ALLOWED = new Map<string, string>([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
  ["image/svg+xml", "svg"],
]);
const MAX_BYTES = 2_000_000;

/** Valida tipo/tamanho da imagem antes de escrever no disco. */
function validateImage(file: File): { ok: boolean; message?: string } {
  if (file.size > MAX_BYTES) {
    return { ok: false, message: "Imagem muito grande (máximo 2 MB)." };
  }
  if (!ALLOWED.has(file.type)) {
    return { ok: false, message: "Formato inválido. Use PNG, JPG, WEBP ou SVG." };
  }
  return { ok: true };
}

/** Nome de arquivo seguro a partir do nome original (sem acentos/espaços). */
function slugifyFilename(name: string): string {
  const base = name
    .replace(/\.[^.]+$/, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
  return base || "logo";
}

/**
 * Faz UPLOAD de uma nova imagem para a Galeria de Mídia (public/uploads/logos/).
 * A imagem fica salva na galeria para usos futuros — NÃO altera, por si só, a
 * logo de login (o admin escolhe a logo clicando na imagem da galeria depois).
 */
export async function uploadGalleryImage(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Selecione uma imagem." };
  }
  const v = validateImage(file);
  if (!v.ok) return { status: "error", message: v.message! };

  const ext = ALLOWED.get(file.type) ?? "png";
  const filename = `${slugifyFilename(file.name)}-${Date.now()}.${ext}`;
  const dir = path.join(process.cwd(), "public", "uploads", "logos");
  try {
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, filename),
      Buffer.from(await file.arrayBuffer()),
    );
  } catch (error) {
    console.error("Erro ao salvar imagem na galeria:", error);
    return { status: "error", message: "Não foi possível salvar o arquivo." };
  }

  revalidatePath("/admin/configuracoes");
  return {
    status: "success",
    message: "Imagem enviada para a galeria.",
  };
}

// Aceita apenas URLs internas da galeria/logos do próprio sistema (anti-abuso).
// Galeria é servida via /api/uploads/logos/<arquivo>; o default fica em /logos/.
const SAFE_LOGO_URL = /^\/(api\/uploads\/logos|logos)\/[A-Za-z0-9._-]+$/;

/**
 * Define a LOGO DA TELA DE LOGIN (configuração GLOBAL/Singleton).
 *
 * Atualiza APENAS o registro único de SystemSettings (id "global") via upsert —
 * jamais toca em Election/Pleitos. String vazia restaura o padrão (null).
 */
export async function setLoginLogo(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const raw = String(formData.get("loginLogoUrl") ?? "").trim();
  const url = raw === "" ? null : raw;

  if (url !== null && !SAFE_LOGO_URL.test(url)) {
    return { status: "error", message: "Imagem inválida." };
  }

  await prisma.systemSettings.upsert({
    where: { id: SYSTEM_SETTINGS_ID },
    update: { loginLogoUrl: url },
    create: { id: SYSTEM_SETTINGS_ID, loginLogoUrl: url },
  });

  revalidatePath("/login");
  revalidatePath("/admin/configuracoes");
  return {
    status: "success",
    message: url
      ? "Logo da tela de login atualizada."
      : "Logo da tela de login redefinida para o padrão.",
  };
}
