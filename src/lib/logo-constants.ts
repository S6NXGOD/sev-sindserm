// Constantes de logo SEGURAS PARA O CLIENTE (sem imports de servidor).
//
// REGRA ESTRITA: a única logo padrão do sistema é a LOGO_DEFAULT, destinada
// EXCLUSIVAMENTE ao SINDSERM. Não existe logo padrão para Pleitos.
//
// O lib/election.ts (server-only, importa Prisma) reexporta esta constante para
// uso no servidor; componentes "use client" devem importar daqui.
export const DEFAULT_LOGO = "/logos/logo_default.png";

// Prefixo público das imagens da galeria de mídia (uploads de logos).
// As imagens são servidas pelo Route Handler /api/uploads/[...file] (lê do
// volume em disco), pois o Next.js 14 NÃO serve arquivos adicionados a /public
// em runtime. No disco elas vivem em public/uploads/logos/.
export const UPLOADS_PREFIX = "/api/uploads/logos/";

/** Imagem da galeria de mídia (pasta public/uploads/logos/). Tipo client-safe. */
export type GalleryImage = {
  /** URL pública (ex.: "/api/uploads/logos/sindserm-...png"). */
  url: string;
  /** Nome do arquivo. */
  name: string;
};
