-- Camada de MANDATO (pós-eleição): representantes materializados na homologação.
-- ADITIVO e idempotente (tabela nova, vazia) — não toca em nenhum dado existente
-- nem na apuração. Aplicar MANUALMENTE na produção ANTES do push
-- (regra "deploy-seguro-migracoes").
CREATE TABLE IF NOT EXISTS "mandatos" (
  "id"                TEXT NOT NULL,
  "electionId"        TEXT NOT NULL,
  "anoEleicao"        INTEGER NOT NULL,
  "workplaceId"       TEXT NOT NULL,
  "rodadaHomologada"  INTEGER NOT NULL DEFAULT 1,
  "nome"              TEXT NOT NULL,
  "candidateIdOrigem" TEXT,
  "papel"             TEXT NOT NULL,
  "ordem"             INTEGER NOT NULL,
  "votosHomologados"  INTEGER NOT NULL DEFAULT 0,
  "situacao"          TEXT NOT NULL DEFAULT 'ATIVO',
  "posseEm"           TIMESTAMP(3),
  "saidaEm"           TIMESTAMP(3),
  "saidaMotivo"       TEXT,
  "assumiuEm"         TIMESTAMP(3),
  "substituiuNome"    TEXT,
  "observacao"        TEXT,
  "homologadoPorNome" TEXT NOT NULL,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mandatos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "mandatos_electionId_anoEleicao_idx"
  ON "mandatos" ("electionId", "anoEleicao");
CREATE INDEX IF NOT EXISTS "mandatos_workplaceId_idx"
  ON "mandatos" ("workplaceId");
CREATE INDEX IF NOT EXISTS "mandatos_anoEleicao_situacao_idx"
  ON "mandatos" ("anoEleicao", "situacao");
-- Unicidade (idempotência da homologação): 1 linha por (local, papel, ordem).
CREATE UNIQUE INDEX IF NOT EXISTS "mandatos_workplaceId_papel_ordem_key"
  ON "mandatos" ("workplaceId", "papel", "ordem");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'mandatos_electionId_fkey'
  ) THEN
    ALTER TABLE "mandatos"
      ADD CONSTRAINT "mandatos_electionId_fkey"
      FOREIGN KEY ("electionId") REFERENCES "elections"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'mandatos_workplaceId_fkey'
  ) THEN
    ALTER TABLE "mandatos"
      ADD CONSTRAINT "mandatos_workplaceId_fkey"
      FOREIGN KEY ("workplaceId") REFERENCES "workplaces"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
