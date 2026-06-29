-- Situação do pleito
CREATE TYPE "ElectionStatus" AS ENUM ('RASCUNHO', 'ATIVO', 'ENCERRADO');

-- Novos campos de configuração do pleito
ALTER TABLE "elections" ADD COLUMN     "slug" TEXT;
ALTER TABLE "elections" ADD COLUMN     "duracaoMandato" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "elections" ADD COLUMN     "dataInicioGeral" TIMESTAMP(3);
ALTER TABLE "elections" ADD COLUMN     "dataFimGeral" TIMESTAMP(3);
ALTER TABLE "elections" ADD COLUMN     "emailOficial" TEXT;
ALTER TABLE "elections" ADD COLUMN     "status" "ElectionStatus" NOT NULL DEFAULT 'ATIVO';

-- Backfill de slug para linhas já existentes (slug provisório por ano)
UPDATE "elections" SET "slug" = 'pleito-' || "ano"::text WHERE "slug" IS NULL;

-- Slug passa a ser obrigatório e único
ALTER TABLE "elections" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "elections_slug_key" ON "elections"("slug");
