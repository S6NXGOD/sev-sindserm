# SEV SINDSERM — Sistema de Votação Eletrônica

Sistema de votação web para eleições de representantes sindicais de base. Cada
**Local de Trabalho** possui um **link público único** com validade de data e
hora. A unicidade do voto é garantida **exclusivamente pelo banco de dados**
(CPF e Matrícula `@unique`) e o **sigilo do voto** é estrutural: não existe
nenhuma relação (foreign key) entre o eleitor (`Voter`) e o voto (`Vote`).

Não há página de boas-vindas: a raiz (`/`) redireciona ao painel (`/admin`), que
exige login. As únicas páginas públicas são os links de votação.

## Stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** + **Shadcn UI** (Radix primitives)
- **Prisma ORM** + **PostgreSQL** (local)
- **Server Actions** para toda a lógica de backend

## Pré-requisitos

- Node.js 18+ (testado com Node 22)
- PostgreSQL rodando localmente na porta `5432`

## Configuração (`.env`)

```
DATABASE_URL="postgresql://postgres:Admin%40123@127.0.0.1:5432/sindserm_dev?schema=public"
ADMIN_PASSWORD="sindserm@2026"          # senha de acesso ao /admin (troque!)
SESSION_SECRET="<aleatório-longo>"      # assina o cookie de sessão (HMAC)
```

> Gere um `SESSION_SECRET` forte com:
> `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`
> Lembre que variáveis de ambiente do SO **sobrescrevem** o `.env`.

> **Dois detalhes importantes do `.env`** (já aplicados):
>
> 1. A senha `Admin@123` contém `@`, que é caractere reservado em uma URL de
>    conexão. Ele **precisa** ser codificado como `%40` → `Admin%40123`. Sem
>    isso o Prisma interpreta o `@` como separador do host e a conexão falha.
> 2. Usamos `127.0.0.1` em vez de `localhost`. No Windows, o engine do Prisma
>    tende a resolver `localhost` para IPv6 (`::1`), que aqui não aceita a
>    conexão, gerando `P1001: Can't reach database server`. Forçar IPv4 com
>    `127.0.0.1` resolve.

## Como rodar

```bash
npm install                 # instala deps e gera o Prisma Client
npm run db:migrate          # cria as tabelas (prisma migrate dev)
npm run db:seed             # (opcional) popula 2 locais de exemplo com links
npm run dev                 # http://localhost:3000
```

> Se o banco `sindserm_dev` ainda não existir, o `prisma migrate dev` o cria
> automaticamente. Caso o seu Postgres bloqueie a criação automática, crie-o
> manualmente: `CREATE DATABASE sindserm_dev;`

Scripts úteis:

| Script              | Ação                                             |
| ------------------- | ------------------------------------------------ |
| `npm run dev`       | Servidor de desenvolvimento                      |
| `npm run build`     | Build de produção (`prisma generate` + `next build`) |
| `npm run db:migrate`| Cria/aplica migrações                            |
| `npm run db:seed`   | Popula dados de exemplo                          |
| `npm run db:studio` | Abre o Prisma Studio                             |

## Rotas

| Rota                       | Acesso   | Descrição                                                        |
| -------------------------- | -------- | ---------------------------------------------------------------- |
| `/`                        | —        | Redireciona para `/admin`                                       |
| `/login`                   | público  | Login do administrador (senha) — tela centralizada com logo padrão |
| `/admin`                   | protegido| **Dashboard** em tempo real (líderes, zonas/órgãos, KPIs, alertas) |
| `/admin/locais`            | protegido| Lista de locais com busca, filtros e paginação                  |
| `/admin/locais/novo`       | protegido| Cadastro de local (órgão fixo, slug sugerido, limite, janela)   |
| `/admin/locais/[id]`       | protegido| Gestão do local: slug, horário, limite, reabrir, candidatos, resultados, votantes |
| `/admin/votantes`          | protegido| Lista de votantes com filtros + exportação CSV                  |
| `/admin/relatorios`        | protegido| Relatórios de apuração (geral, órgão, local, encerradas) + PDF  |
| `/admin/pleitos`           | protegido| **Pleitos**: lista de eleições + logos; cadastro de novo pleito |
| `/admin/pleitos/novo`      | protegido| Cadastro de pleito (título, ano, logos)                         |
| `/admin/configuracoes`     | protegido| Upload das logos do pleito selecionado                          |
| `/votacao/[linkToken]`     | público  | Formulário de votação + **comprovante em PDF**                  |

As rotas administrativas usam uma **sidebar** (com **seletor de pleito** e logos
dinâmicas no topo) via route group `(painel)` em `src/app/admin/(painel)/`.

Todas as rotas `/admin/*` são protegidas por `src/middleware.ts` (cookie de
sessão assinado, HMAC-SHA256); sem sessão, redireciona para `/login`.

## Pleitos e logos por eleição

Cada eleição é um **pleito** (tabela `Election`, 1 por ano) com **título** e duas
logos (`logoSindsermUrl`, `logoPleitoUrl`) **isoladas por triênio** — o upload de
um ano nunca substitui as imagens de outro.

- **`/admin/pleitos`** lista os pleitos e permite **criar um novo**
  (`/admin/pleitos/novo`): título, ano de referência e (opcional) as duas logos.
- **Upload seguro** ([config.ts](src/lib/actions/config.ts)): salva em
  `public/uploads/logos/` com o **ID do pleito no nome do arquivo**
  (`sindserm-<id>-<timestamp>.png`); valida tipo (PNG/JPG/WEBP/SVG) e tamanho
  (≤ 2 MB). Sem upload, usa **logos genéricas padrão** (fallback) de `public/logos/`.
- As logos mudam **dinamicamente** conforme o pleito selecionado: **sidebar**
  (topo), **página pública de votação** (pela eleição do `Workplace`),
  **comprovante PDF** e **cabeçalho das atas/relatórios** (esquerda: SINDSERM ·
  centro: título/dados · direita: pleito). `NEXT_PUBLIC_CURRENT_ELECTION_YEAR`
  define o pleito vigente.

## Funcionalidades do painel

- **Login/senha** com sessão por cookie assinado (8h), via `ADMIN_PASSWORD`.
- **Dashboard em tempo real** (`/admin`, atualização automática 15s + badge
  “Tempo Real” pulsante), com **Recharts** e seletor de eleição:
  - Cabeçalho do pleito: “Eleições Representantes de Base — Triênio AAAA-AAAA”.
  - **KPIs**: Total de votos, Locais ativos (votando agora), **Votos na última
    hora** (via `Voter.createdAt`, já que `Vote` não tem timestamp — sigilo),
    + locais, candidatos, encerradas, não iniciadas.
  - **Gráficos**: área do **ritmo da votação** (votos por hora, hoje) e **rosca**
    do status dos links (Aguardando início / Em andamento / Encerrados).
  - **Liderança Parcial por Local (Zonas Ativas)**: para os locais com votação
    em andamento, mostra vagas (regra de corte) e os candidatos que se elegeriam
    naquele instante. Window function em SQL (escalável).
  - **Divisão por Zonas** (barras de progresso) e **Ranking de Adesão**
    (3 locais com mais e 3 com menos votos).
  - **Alertas**: locais sem candidatos, que atingiram o limite, e encerrando em 24h.

> Nota de sigilo: o ritmo/“votos por hora” usa o horário de **comparecimento**
> (`Voter.createdAt`, relação 1:1 com o voto), nunca a escolha do candidato.
- **Lista de locais** com busca por nome/slug, filtro por órgão, zona e status,
  e **paginação** no servidor (20/página).
- **Slug personalizável** do link público, **sugerido automaticamente** a
  partir do nome do local (ex.: `escola-municipal-dom-barreto`). Unicidade
  garantida pelo banco.
- **Órgão** como lista fixa (25 órgãos da Prefeitura de Teresina).
- **Limite de votos** por local (limitado ou ilimitado), aplicado no momento do
  voto.
- **Importação de candidatos por CSV** (na página do local): envie um `.csv` com
  uma coluna `nome`. O parser ([src/lib/csv.ts](src/lib/csv.ts)) trata BOM,
  `\r\n`, aspas, separador `,`/`;`, ignora o cabeçalho e remove duplicatas;
  mostra prévia de “N nomes detectados”. **Sem limite de quantidade**: o cliente
  envia os nomes em **lotes** (500 por requisição) para a Server Action
  [`importCandidatesChunk`](src/lib/actions/admin.ts) (`createMany` por lote),
  exibindo uma **barra de progresso** e dando feedback via Toast no fim
  (testado com 1.773 candidatos).
- **Módulo de Votantes** (`/admin/votantes`) — mapa de potenciais filiados:
  filtros combinados por **filiação** (Filiados / Não filiados), **local**,
  **zona**, **órgão** e busca por nome; coluna de **Filiação** na tabela; e
  **“Exportar para CSV”** dos votantes filtrados (Nome, Telefone, Email, Órgão,
  Local, Zona) — para campanhas de filiação focadas. Mostra apenas **quem
  compareceu e quando**, preservando o sigilo da escolha.
- **Encerramento manual** da votação a qualquer momento (antes do horário),
  com confirmação em modal próprio; e **reabertura** definindo novo término.
- **Vencedor exibido ao encerrar**: na página do local e nos relatórios, ao
  encerrar (por horário ou manualmente) aparece o candidato vencedor — com
  tratamento de **empate** e de votação sem votos.
- **Exclusão com confirmação dentro do sistema** (modal próprio, sem alertas do
  navegador).
- **Regras de integridade**: locais **não podem ser excluídos**; candidatos
  **não podem ser excluídos se já tiverem votos**.

## Isolamento por eleição/triênio (anoEleicao)

O sistema é reutilizável a cada eleição (2026, 2029, 2032…) sem misturar dados:

- Os modelos **Workplace, Voter e Vote** têm o campo **`anoEleicao`** (Int).
- A unicidade do voto é **por ano**: `Voter` usa `@@unique([cpf, anoEleicao])` e
  `@@unique([matricula, anoEleicao])` — um eleitor não vota duas vezes no mesmo
  ano, mas **pode** participar nas eleições seguintes. O `linkToken` também é
  único por ano (`@@unique([linkToken, anoEleicao])`), permitindo **reutilizar o
  mesmo slug** em outro triênio.
- O **ano vigente** vem de `NEXT_PUBLIC_CURRENT_ELECTION_YEAR` (ex.: `2026`):
  - A **votação pública** só serve a eleição vigente (links de anos anteriores
    retornam 404) e grava `anoEleicao` no eleitor/voto.
  - O **painel** filtra tudo por ano. Há um **seletor de ano** (histórico) no
    Dashboard, Locais, Votantes e Relatórios para **auditar eleições passadas**
    (`?ano=YYYY`); o padrão é sempre o ano vigente.
- Para a próxima eleição, basta alterar `NEXT_PUBLIC_CURRENT_ELECTION_YEAR` no
  `.env` — os dados anteriores ficam preservados e acessíveis só para consulta.

## Logos por pleito (isoladas por triênio)

Cada pleito tem suas próprias logos, guardadas na tabela **`Election`**
(`ano @unique`, `logoSindsermUrl`, `logoPleitoUrl`):

- **Sidebar** (`/admin`): seletor de **Pleito** (Triênio AAAA-AAAA) no topo; acima
  dele, a logo do SINDSERM e a do pleito **mudam dinamicamente** ao alternar o
  pleito (via `?ano=`).
- **Votação pública**: descobre o pleito do `Workplace` (pelo `anoEleicao`) e
  renderiza as logos daquela eleição (com fallback genérico).
- **Relatórios/atas** (impressão): cabeçalho oficial com **logo do SINDSERM à
  esquerda**, título + dados da apuração ao centro e **logo do pleito à direita**.
- **Comprovante (PDF)**: usa a logo do pleito.
- **Upload** (`/admin/configuracoes`): envia as duas imagens para o pleito ativo.
  O arquivo é salvo em `public/uploads/logos/` com o **ID do pleito no nome**
  (`sindserm-<idPleito>-<timestamp>.png`), então o envio de um ano **nunca**
  substitui a imagem de outro. Sem upload, usam-se **logos genéricas padrão**
  (`public/logos/`).

## Escala e performance (até ~1.700 candidatos por local)

O sistema foi projetado para não carregar dados brutos de milhares de registros
na memória nem no HTML:

- **Votação pública** ([/votacao/[linkToken]](src/app/votacao/[linkToken]/page.tsx)):
  a seleção de candidato usa um **autocomplete assíncrono** (Command + Popover —
  [candidate-combobox.tsx](src/components/candidate-combobox.tsx)). A página
  **não** carrega a lista de candidatos; ela busca sob demanda via a Server
  Action [`searchCandidates`](src/lib/actions/votacao.ts) (`contains`,
  `take: 20`, com debounce). O `castVote` valida o candidato por consulta
  direcionada (sem carregar a lista).
- **Gestão de candidatos** ([/admin/locais/[id]](src/app/admin/(painel)/locais/[id]/page.tsx)):
  a lista é **paginada no banco** (`skip`/`take: 50`) com **busca por nome** via
  parâmetros de URL (`cq`, `cpage`). A apuração de eleitos usa
  **`prisma.vote.groupBy`** (top por votos) — não percorre todos os candidatos.
- **Dashboard** ([src/lib/dashboard.ts](src/lib/dashboard.ts)): rankings via
  **`prisma.vote.groupBy`** (votos por local / por candidato) e **window
  functions em SQL** (`ROW_NUMBER() OVER (PARTITION BY ...)`) para o líder por
  zona/órgão — tudo agregado no PostgreSQL, sem trazer linhas brutas ao Node.

## Vagas de eleitos (regra de progressão)

O número de **eleitos por local** depende do total de **candidatos cadastrados**
naquele local, em [src/lib/vagas.ts](src/lib/vagas.ts):

| Candidatos | Vagas |
| ---------- | ----- |
| 1–9        | 1     |
| 10–16      | 2     |
| 17–19      | 3     |
| 20–26      | 4     |
| 27–29      | 5     |
| 30–36      | 6     |

A progressão segue infinitamente: abre-se **uma nova vaga** sempre que o total
de candidatos atinge um número **terminado em 0 ou em 7** (37 → 7, 40 → 8,
47 → 9, 50 → 10, …).

- `calcularVagas(totalCandidatos)` — devolve o nº de vagas.
- `apurarEleitos(candidatos)` — devolve os **eleitos** (top N por votos),
  tratando **empate na linha de corte** (candidatos empatados disputando a
  vaga restante ficam sinalizados como “necessário desempate”).

Aplicado em: **página do local** (banner de eleitos + marcação nos resultados),
**relatórios** (eleitos por local + tabela) e **lista de locais** (coluna
*Vagas*). Candidatos dentro da linha de corte recebem a badge **“Eleito”**; os
demais que receberam ao menos 1 voto recebem **“Suplente”**.

## Relatórios de apuração (`/admin/relatorios`)

Relatórios para controle da apuração, com **impressão / salvar em PDF** (botão
que usa a impressão do navegador, com layout próprio para impressão):

- **Geral** — todos os locais + resumo (votos por órgão e por zona, status).
- **Por órgão** — filtrado por um órgão específico ou todos.
- **Por local de trabalho** — apuração individual e detalhada (atalho também na
  página do local, botão “Relatório”).
- **Votações encerradas** — apenas as encerradas, com o vencedor de cada uma.

Os relatórios usam **agregação no banco** (`groupBy` por `(workplaceId,
candidateId)`), sem carregar a lista bruta de candidatos. Cada local lista
**apenas os candidatos com votos** (até 100), com resumo de “+N sem votos” —
assim um local com milhares de candidatos e poucos/zero votos não gera uma
listagem gigante (ex.: 1.773 candidatos e 0 votos ⇒ apenas “Sem votos.”).

## Comprovante de votação (PDF)

Após votar, o eleitor pode **baixar um comprovante em PDF** (gerado no navegador
com `jspdf`, carregado sob demanda). O comprovante traz nome, CPF mascarado,
matrícula, local, órgão, zona, data/hora e um **protocolo** único — e **nunca** o
candidato escolhido, preservando o sigilo.

## Modelo de dados (Prisma)

- **Workplace** — `nome`, `zona` (enum `SUL/LESTE/SUDESTE/NORTE/CENTRO/RURAL`),
  `orgao`, `linkToken` (`@unique`, é o slug), `dataInicioVotacao`,
  `dataFimVotacao`, `voteLimit` (`Int?`, null = ilimitado).
- **Candidate** — `nome`, `workplaceId` → relação com `Workplace`.
- **Voter** — `nome`, `cpf`, `telefone?`, `matricula`, `email?`, `workplaceId`,
  `anoEleicao`, `isFiliado` (declarada no voto), `protocolo` (`@unique`,
  impresso no comprovante), `createdAt`. Unicidade por ano
  (`@@unique([cpf, anoEleicao])` e `@@unique([matricula, anoEleicao])`). O
  vínculo com `Workplace` registra apenas **onde** votou, nunca **em quem**.
- **Vote** — `candidateId`, `workplaceId`. **Sem qualquer relação com `Voter`** e
  **sem timestamp** (impede correlacionar voto e votante por horário).

## Regra de votação (Server Action `castVote`)

`src/lib/actions/votacao.ts`:

1. Localiza o `Workplace` pelo `linkToken`.
2. Valida a janela de votação (`agora` entre início e fim).
3. Valida os campos, o CPF (dígitos verificadores) e o aceite LGPD.
4. Em uma transação: cria o `Voter` (onde ocorre a checagem de unicidade) e, em
   seguida, cria o `Vote` de forma **anônima**.
5. Se o Prisma lançar `P2002` (Unique Constraint Violation) em CPF ou Matrícula,
   retorna imediatamente: **"Voto já registrado para este CPF ou Matrícula"**.

> A transação garante que, se o registro do voto falhar, o eleitor também não é
> persistido — mas em nenhum momento há vínculo entre as duas tabelas.

## Deploy

Guia completo em [`DEPLOY.md`](DEPLOY.md): **A)** Node/VPS, **B)** Render,
**C)** Docker/Compose.

### D) Deploy via Railway

A [Railway](https://railway.app) usa o arquivo [`railway.toml`](railway.toml) na
raiz (builder **Nixpacks**). As **migrações** e o **seed do admin** rodam no
_start_ — com o banco já online e conectado —, não no build. O `startCommand` é:

```
npm run db:deploy && npm run db:seed && npm run start
```

Passos:

1. Crie o projeto na Railway a partir do repositório e adicione um banco
   **PostgreSQL** (a Railway injeta a `DATABASE_URL` automaticamente).
2. Configure as variáveis: `SESSION_SECRET` e `NEXT_PUBLIC_CURRENT_ELECTION_YEAR`
   (e, se quiser, `ADMIN_PASSWORD`).
3. **Monte um Volume** no serviço com o **Mount Path** `/app/public/uploads`
   para **persistir as logos** enviadas pelo admin entre os deploys — sem o
   volume, os uploads em `public/uploads` são perdidos a cada redeploy.

## Logos

A única logo **estática** do sistema é `public/logos/logo_default.png` (servida
em `/logos/logo_default.png`). Ela é a logo **padrão do SINDSERM** e a logo da
**tela de login**, usada como _fallback_ quando um pleito não tem logo própria.

As logos específicas de cada pleito são enviadas pelo administrador (Galeria de
Mídia) e ficam isoladas em `public/uploads/logos/`. A regra de resolução
(padrão × do pleito) fica em `src/lib/election.ts` — `resolveSindsermLogo()` e
`resolvePleitoLogo()`.

## LGPD

O formulário exige aceite explícito de tratamento de dados, citando a fonte
legal: **Lei Geral de Proteção de Dados Pessoais (LGPD) — Lei nº 13.709/2018,
Art. 7º, inciso I** (consentimento do titular).
