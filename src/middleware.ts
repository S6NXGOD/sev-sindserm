import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  verifySessionToken,
} from "@/lib/auth";

/**
 * Proteção de rotas (edge).
 *
 * CONTRATO DE SEGURANÇA:
 *  - Tudo que começa com /admin EXIGE um token de sessão VÁLIDO (cookie
 *    `admin_session`, assinado com HMAC-SHA256 — equivalente a um JWT próprio,
 *    verificado em src/lib/auth.ts). Sem token válido → redireciona para /login.
 *  - PÚBLICO (nunca passa por aqui, por não casar com o matcher abaixo):
 *      • /login                       (tela de login + Server Action de auth)
 *      • /transparencia               (portal público de apuração/auditoria)
 *      • /votacao/[linkToken]         (votação pública)
 *      • /, assets e demais rotas
 *  Como o matcher cobre SOMENTE "/admin/:path*", a regra é "nega /admin, libera
 *  o resto" — sem exceções escondidas. A verificação roda no Edge (Web Crypto),
 *  então é a MESMA lógica de token usada pelas Server Actions (Node).
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const isValid = await verifySessionToken(token);

  if (!isValid) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Sessão persistente: REEMITE o cookie a cada requisição (refresh deslizante).
  // Assim a expiração do cookie do navegador é sempre renovada e o usuário só
  // sai ao clicar em "Sair" — nunca por inatividade/tempo de token.
  const res = NextResponse.next();
  if (token) {
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
  }
  return res;
}

// Protege EXCLUSIVAMENTE as rotas administrativas. Qualquer outra rota é pública.
export const config = {
  matcher: ["/admin/:path*"],
};
