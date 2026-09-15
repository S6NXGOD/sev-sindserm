-- Eleição SUPLEMENTAR por RODADAS. Aditivo e retrocompatível: tudo que já existe
-- fica na rodada 1, sem eleitos preservados — comportamento idêntico ao atual.

-- Novas colunas (com defaults seguros para os dados existentes).
ALTER TABLE "votes"      ADD COLUMN IF NOT EXISTS "rodada" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "voters"     ADD COLUMN IF NOT EXISTS "rodada" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "workplaces" ADD COLUMN IF NOT EXISTS "rodadaAtual" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "candidates" ADD COLUMN IF NOT EXISTS "eleitoPreservado" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "candidates" ADD COLUMN IF NOT EXISTS "preservadoVotos" INTEGER;

-- Unicidade do votante passa a ser POR RODADA (permite re-votar na suplementar,
-- mas só uma vez por rodada). Como todos os dados são rodada 1, não há conflito.
DROP INDEX IF EXISTS "voters_cpf_anoEleicao_key";
DROP INDEX IF EXISTS "voters_matricula_anoEleicao_key";
CREATE UNIQUE INDEX IF NOT EXISTS "voters_cpf_anoEleicao_rodada_key"
  ON "voters" ("cpf", "anoEleicao", "rodada");
CREATE UNIQUE INDEX IF NOT EXISTS "voters_matricula_anoEleicao_rodada_key"
  ON "voters" ("matricula", "anoEleicao", "rodada");

-- Índice para a apuração filtrar votos pela rodada atual do local.
CREATE INDEX IF NOT EXISTS "votes_workplaceId_rodada_idx"
  ON "votes" ("workplaceId", "rodada");
