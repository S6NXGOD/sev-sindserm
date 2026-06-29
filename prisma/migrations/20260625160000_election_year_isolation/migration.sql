-- Isolamento por ano de eleição (triênio).
-- Backfill dos registros existentes com 2026 e, em seguida, remove o DEFAULT
-- (o app passa a fornecer anoEleicao explicitamente em cada inserção).

-- ===== Workplace =====
ALTER TABLE "workplaces" ADD COLUMN "anoEleicao" INTEGER NOT NULL DEFAULT 2026;
ALTER TABLE "workplaces" ALTER COLUMN "anoEleicao" DROP DEFAULT;

-- linkToken passa a ser único POR ano (permite reutilizar o slug em outro triênio).
DROP INDEX "workplaces_linkToken_key";
CREATE UNIQUE INDEX "workplaces_linkToken_anoEleicao_key" ON "workplaces"("linkToken", "anoEleicao");
CREATE INDEX "workplaces_anoEleicao_idx" ON "workplaces"("anoEleicao");

-- ===== Voter =====
ALTER TABLE "voters" ADD COLUMN "anoEleicao" INTEGER NOT NULL DEFAULT 2026;
ALTER TABLE "voters" ALTER COLUMN "anoEleicao" DROP DEFAULT;

-- Remove a unicidade GLOBAL de cpf/matricula e cria unicidade POR ano.
DROP INDEX "voters_cpf_key";
DROP INDEX "voters_matricula_key";
CREATE UNIQUE INDEX "voters_cpf_anoEleicao_key" ON "voters"("cpf", "anoEleicao");
CREATE UNIQUE INDEX "voters_matricula_anoEleicao_key" ON "voters"("matricula", "anoEleicao");
CREATE INDEX "voters_anoEleicao_idx" ON "voters"("anoEleicao");

-- ===== Vote =====
ALTER TABLE "votes" ADD COLUMN "anoEleicao" INTEGER NOT NULL DEFAULT 2026;
ALTER TABLE "votes" ALTER COLUMN "anoEleicao" DROP DEFAULT;
CREATE INDEX "votes_anoEleicao_idx" ON "votes"("anoEleicao");
