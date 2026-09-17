# Build determinístico do SEV SINDSERM no Railway.
#
# POR QUÊ: o builder Nixpacks passou a FALHAR na fase de planejamento
# ("nixpacks exited with an error", ~13s, antes mesmo de rodar `npm run build`)
# após um bump de versão do Nixpacks no Railway — deixando a produção presa num
# build de horas atrás. Um Dockerfile remove essa fragilidade: a imagem é sempre
# a mesma, resolvida por nós, sem depender da resolução de pacotes Nix do Railway.
#
# O RUNTIME NÃO MUDA: o comando de start continua vindo do railway.toml
# ([deploy].startCommand = migrate deploy + seed + next start), a porta é a env
# PORT do Railway e o volume de uploads é montado em runtime. Só o BUILD mudou.

FROM node:20-slim

# openssl/ca-certificates: o engine do Prisma precisa deles na base slim (Debian).
RUN apt-get update -y \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# 1) Dependências (com o lockfile — instalação reprodutível). O `prisma` precisa
#    do schema já presente porque o postinstall roda `prisma generate`.
#    --include=dev garante typescript/tailwind/eslint mesmo se NODE_ENV=production.
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --include=dev

# 2) Código + build (`prisma generate && next build`). O engine do Prisma é
#    gerado para ESTA imagem (Debian/OpenSSL 3), a mesma do runtime.
COPY . .
RUN npm run build

# 3) Runtime em produção. O startCommand real vem do railway.toml; o CMD abaixo é
#    só um fallback coerente (`next start` respeita a env PORT do Railway).
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "run", "start"]
