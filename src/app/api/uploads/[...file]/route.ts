import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

// PORQUÊ desta rota: o Next.js 14 só serve estaticamente os arquivos que estavam
// em /public NO MOMENTO DO BUILD. Logos enviadas pelo admin em runtime (gravadas
// no volume persistente em /app/public/uploads) NÃO são servidas e dariam 404.
// Este Route Handler lê o arquivo do disco e o devolve com o Content-Type certo.

// Lê do disco → precisa do runtime Node (não "edge").
export const runtime = "nodejs";
// Os arquivos chegam em runtime: nunca pré-renderizar/estatizar esta rota.
export const dynamic = "force-dynamic";

// Raiz física dos uploads. Em produção (Railway) o volume é montado exatamente
// aqui: process.cwd() === "/app"  →  /app/public/uploads
const UPLOADS_ROOT = path.join(process.cwd(), "public", "uploads");

const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

export async function GET(
  _request: Request,
  { params }: { params: { file: string[] } },
) {
  const segments = params.file ?? [];

  // Anti-travessia de diretório: rejeita vazios, "." / ".." e separadores.
  if (
    segments.length === 0 ||
    segments.some(
      (s) =>
        !s || s === "." || s === ".." || s.includes("/") || s.includes("\\"),
    )
  ) {
    return new NextResponse("Requisição inválida", { status: 400 });
  }

  const ext = path.extname(segments[segments.length - 1]).toLowerCase();
  const contentType = CONTENT_TYPES[ext];
  if (!contentType) {
    return new NextResponse("Tipo de arquivo não suportado", { status: 415 });
  }

  const resolved = path.resolve(UPLOADS_ROOT, ...segments);

  // Garantia final: o caminho resolvido tem de ficar DENTRO de UPLOADS_ROOT.
  if (
    resolved !== UPLOADS_ROOT &&
    !resolved.startsWith(UPLOADS_ROOT + path.sep)
  ) {
    return new NextResponse("Acesso negado", { status: 403 });
  }

  let data: Buffer;
  try {
    data = await readFile(resolved);
  } catch {
    return new NextResponse("Arquivo não encontrado", { status: 404 });
  }

  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Content-Length": String(data.byteLength),
    "X-Content-Type-Options": "nosniff",
    // Nomes de arquivo carregam timestamp (imutáveis) → cache longo.
    "Cache-Control": "public, max-age=31536000, immutable",
  };
  // SVG é admin-only, mas reforça: neutraliza scripts em acesso direto.
  if (ext === ".svg") {
    headers["Content-Security-Policy"] =
      "default-src 'none'; style-src 'unsafe-inline'; sandbox";
  }

  return new NextResponse(new Uint8Array(data), { headers });
}
