# Deploy — SEV SINDSERM

Guia de implantação do **Sistema Eletrônico de Votação do SINDSERM**.

## Stack
- **Next.js 14** (App Router) + React 18 + Tailwind/Shadcn UI
- **Prisma 5** + **PostgreSQL**
- **Autenticação**: cookie de sessão assinado com HMAC-SHA256 (edge-safe). _Não usa NextAuth/JWT padrão._ A senha de admin é guardada com hash **scrypt** na tabela `Setting`, com `ADMIN_PASSWORD` (env) como fallback de bootstrap.

## Requisitos
- Node.js **20+**
- PostgreSQL **14+**
- (Opcional) Docker / Docker Compose

## Variáveis de ambiente
Modelo completo em [`.env.example`](.env.example).

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | ✅ | Conexão Postgres (`...?sslmode=require` em produção). |
| `SESSION_SECRET` | ✅ (prod) | Segredo que assina o cookie de sessão. Gere: `openssl rand -base64 48`. |
| `ADMIN_PASSWORD` | ⬜ | Senha de admin (bootstrap/fallback). Usada enquanto não houver senha no banco. |
| `NEXT_PUBLIC_CURRENT_ELECTION_YEAR` | ✅ | Ano do pleito vigente (avaliado no servidor). Ex.: `2026`. |

## A) Deploy genérico (Node / VPS)
```bash
git clone <seu-repo> && cd sistema_votacao
cp .env.example .env        # preencha DATABASE_URL, SESSION_SECRET, ...
npm ci
npm run build              # prisma generate + next build
npm run db:deploy          # aplica as migrações (cria as tabelas)
npm run db:seed            # cria o admin (Sindserm@2026) — idempotente
npm run start              # sobe na porta 3000
```
Use um gerenciador de processos (PM2/systemd) e um proxy reverso (Nginx) com HTTPS.

## B) Render (1 clique via Blueprint)
Use [`render.yaml`](render.yaml): em **Blueprints → New Blueprint Instance**, aponte para o repositório. Ele provisiona **PostgreSQL + Web Service**, gera o `SESSION_SECRET`, roda `build → migrate → seed` e monta um **disco persistente** para as logos. Defina `ADMIN_PASSWORD` no painel se não quiser o padrão.

## C) Docker / Docker Compose (self-host)
Stack completa (app + Postgres) com [`docker-compose.yml`](docker-compose.yml):
```bash
cp .env.example .env        # defina ao menos SESSION_SECRET (e ADMIN_PASSWORD)
docker compose up -d --build
```
- App em `http://localhost:3000`, Postgres interno, **volumes** persistentes para o banco e para `public/uploads`.
- As migrações são aplicadas **no start** do contêiner (`docker-entrypoint.sh` → `prisma migrate deploy`).
- Só a imagem do app: `docker build -t sev-sindserm .` e forneça `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_PASSWORD`, `NEXT_PUBLIC_CURRENT_ELECTION_YEAR`.

## Primeiro acesso (pós-deploy)
1. Acesse **`/login`** e entre com `Sindserm@2026` (ou o `ADMIN_PASSWORD` definido).
2. **Troque a senha** em _Configurações → Segurança_.
3. **Crie o primeiro pleito** (`/admin/pleitos/novo`) — obrigatório antes de usar os demais módulos.
4. Rotas públicas: **`/transparencia`** (portal) e **`/votacao/<slug>`** (votação).

## ⚠️ Notas de produção
- **Uploads de logos** ficam em `public/uploads/logos` no disco do servidor. Use **disco/volume persistente** (Render `disk:`, volume do Docker), senão as logos somem a cada redeploy.
- **Migrações** rodam como passo próprio (`npm run db:deploy`), **fora** do `build` — assim o `next build` nunca depende do banco. Cada plataforma aplica as migrações no momento certo: Render (no `buildCommand`), Railway (no `startCommand` do `railway.toml`) e Docker (no _entrypoint_, no start do contêiner).
- **`SESSION_SECRET`** é obrigatório em produção (sem ele há um segredo inseguro de desenvolvimento).
- **Bootstrap do admin**: o `npm run db:seed` grava a senha com hash no banco. No Docker enxuto (standalone) o seed não roda no contêiner — use `ADMIN_PASSWORD` (fallback) ou rode `npm run db:seed` a partir de um ambiente completo apontando para o mesmo banco.
- **Reset de desenvolvimento**: `npx prisma migrate reset` recria o banco e aplica todas as migrações.

## Scripts úteis
| Script | O que faz |
|---|---|
| `npm run build` | `prisma generate && next build` (sem migração — veja `db:deploy`). |
| `npm run db:deploy` | Aplica migrações (`prisma migrate deploy`). |
| `npm run db:seed` | Cria o admin padrão (idempotente). |
| `npm run db:seed:demo` | **Dev**: massa de demonstração (⚠️ apaga dados). |
| `npm run db:studio` | Abre o Prisma Studio. |
