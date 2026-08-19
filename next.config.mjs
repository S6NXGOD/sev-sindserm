/** @type {import('next').NextConfig} */

// Cabeçalhos de segurança aplicados a TODAS as respostas (defesa em profundidade).
// Escolhidos para NÃO quebrar a aplicação: nada aqui bloqueia scripts/estilos
// legítimos do próprio app. (Um Content-Security-Policy completo exige testes em
// staging por causa de estilos inline/Next — recomendado à parte.)
const securityHeaders = [
  // Força HTTPS por 2 anos (o app roda só em https em produção). Sem
  // includeSubDomains/preload para não afetar outros subdomínios do sindicato.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000",
  },
  // Anti-clickjacking: a página não pode ser embutida em iframe de outra origem.
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Impede o navegador de "adivinhar" o tipo do conteúdo (anti-MIME-sniffing).
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Não vaza a URL completa (com querystring) para sites externos.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Desliga APIs de navegador que o app não usa (reduz superfície).
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
];

const nextConfig = {
  reactStrictMode: true,
  // Saída autocontida (server.js + deps traçadas) para uma imagem Docker enxuta.
  // Inofensivo fora do Docker (Vercel/Render seguem usando `next start`).
  output: "standalone",
  // Não expõe o header "X-Powered-By: Next.js" (menos fingerprinting).
  poweredByHeader: false,
  experimental: {
    serverActions: {
      // Logos podem ter até 2 MB; o limite padrão de Server Actions é 1 MB e
      // rejeitava o upload com "Failed to fetch". Damos margem para o multipart.
      bodySizeLimit: "5mb",
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
