# syntax=docker/dockerfile:1
# Imagem de produção do SEV SINDSERM (Next.js 14 standalone + Prisma).
# As migrações (prisma migrate deploy) rodam no START do contêiner — não no
# build — porque o build não tem (nem deve ter) acesso ao banco.

# ---------- deps: instala TODAS as dependências ----------
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY package.json package-lock.json ./
RUN npm ci

# ---------- builder: gera o client Prisma e compila o Next ----------
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Sem `migrate deploy` aqui (sem banco no build): só gera o client e compila.
RUN npx prisma generate && npx next build

# ---------- runner: imagem final enxuta ----------
FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

# Artefatos do Next standalone (server.js + node_modules traçado + static).
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Prisma CLI + engines + schema/migrations para `migrate deploy` em runtime.
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

COPY --chmod=755 docker-entrypoint.sh ./docker-entrypoint.sh

# Pasta de uploads (logos): monte um volume aqui para persistir entre deploys.
RUN mkdir -p public/uploads/logos && chown -R nextjs:nodejs public/uploads

USER nextjs
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
