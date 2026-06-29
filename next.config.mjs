/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Saída autocontida (server.js + deps traçadas) para uma imagem Docker enxuta.
  // Inofensivo fora do Docker (Vercel/Render seguem usando `next start`).
  output: "standalone",
  experimental: {
    serverActions: {
      // Logos podem ter até 2 MB; o limite padrão de Server Actions é 1 MB e
      // rejeitava o upload com "Failed to fetch". Damos margem para o multipart.
      bodySizeLimit: "5mb",
    },
  },
};

export default nextConfig;
