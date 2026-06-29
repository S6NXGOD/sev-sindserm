#!/bin/sh
set -e

# Aplica as migrações pendentes no banco de produção (idempotente e seguro).
echo "→ Aplicando migrações (prisma migrate deploy)..."
node ./node_modules/prisma/build/index.js migrate deploy

# Observação sobre o ADMIN:
# A imagem enxuta (standalone) não inclui o tsx/src para rodar `prisma db seed`.
# Em Docker, o acesso de admin é resolvido pela variável ADMIN_PASSWORD (fallback
# de login). Defina ADMIN_PASSWORD no ambiente do contêiner e troque a senha no
# primeiro acesso. (Para gravar a senha com hash no banco via seed, rode
# `npm run db:seed` a partir de um ambiente completo apontando para o mesmo DB.)

echo "→ Iniciando o servidor SEV SINDSERM..."
exec "$@"
