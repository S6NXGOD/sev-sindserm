import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_LOGO,
  UPLOADS_PREFIX,
  type GalleryImage,
} from "@/lib/logo-constants";

// IMPORTANTE: este módulo lê do disco e do Prisma — use-o apenas no servidor
// (Server Actions e Server Components). Componentes "use client" devem receber
// os dados por prop e importar apenas TIPOS daqui (import type).

/** Singleton de configurações globais: sempre a mesma linha (id fixo). */
export const SYSTEM_SETTINGS_ID = "global";

/**
 * Logo padrão da tela de login (FALLBACK ESTRITO). Reaproveita a logo padrão
 * única do sistema (arquivo real em public/logos/logo_default.png), garantindo
 * que o /login nunca renderize uma imagem quebrada quando não houver logo
 * configurada no banco.
 */
export const DEFAULT_LOGIN_LOGO = DEFAULT_LOGO;

// Tipo único da galeria vive em logo-constants (client-safe); reexportado aqui
// para os consumidores que já importam `GalleryImage` deste módulo.
export type { GalleryImage };

const GALLERY_DIR = path.join(process.cwd(), "public", "uploads", "logos");
const IMAGE_RE = /\.(png|jpe?g|webp|svg)$/i;

/**
 * Lista todas as imagens da Galeria de Mídia (public/uploads/logos/), das mais
 * recentes para as mais antigas. Ignora não-imagens (ex.: .gitkeep). Se a pasta
 * não existir ainda, devolve lista vazia (sem erro).
 */
export async function listGalleryImages(): Promise<GalleryImage[]> {
  let entries: string[];
  try {
    entries = await readdir(GALLERY_DIR);
  } catch {
    return [];
  }

  const arquivos = entries.filter((nome) => IMAGE_RE.test(nome));
  const comData = await Promise.all(
    arquivos.map(async (name) => {
      const s = await stat(path.join(GALLERY_DIR, name));
      return { name, url: `${UPLOADS_PREFIX}${name}`, mtime: s.mtimeMs };
    }),
  );

  return comData
    .sort((a, b) => b.mtime - a.mtime)
    .map(({ name, url }) => ({ name, url }));
}

/**
 * Valor BRUTO da logo de login salvo no banco (ou null se não configurada).
 * Use para saber se há uma logo customizada — para EXIBIR, prefira
 * getLoginLogoUrl(), que já aplica o fallback.
 */
export async function getLoginLogoSetting(): Promise<string | null> {
  const settings = await prisma.systemSettings.findUnique({
    where: { id: SYSTEM_SETTINGS_ID },
    select: { loginLogoUrl: true },
  });
  const url = settings?.loginLogoUrl?.trim();
  return url ? url : null;
}

/**
 * URL da logo da tela de login, COM fallback estrito: se não houver logo
 * configurada (null/vazia), devolve DEFAULT_LOGIN_LOGO. Nunca devolve vazio.
 */
export async function getLoginLogoUrl(): Promise<string> {
  return (await getLoginLogoSetting()) ?? DEFAULT_LOGIN_LOGO;
}
