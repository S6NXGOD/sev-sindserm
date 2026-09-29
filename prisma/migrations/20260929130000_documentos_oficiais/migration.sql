-- Atas & Documentos oficiais do pleito. ADITIVO e idempotente (não toca em
-- nenhuma tabela existente nem nos dados da eleição em curso). Aplicar
-- MANUALMENTE na produção ANTES do push (regra "deploy-seguro-migracoes").
CREATE TABLE IF NOT EXISTS "documentos" (
  "id"               TEXT NOT NULL,
  "electionId"       TEXT NOT NULL,
  "anoEleicao"       INTEGER NOT NULL,
  "titulo"           TEXT NOT NULL,
  "categoria"        TEXT NOT NULL,
  "arquivoUrl"       TEXT NOT NULL,
  "tamanho"          INTEGER NOT NULL,
  "mime"             TEXT NOT NULL,
  "publicadoPorId"   TEXT,
  "publicadoPorNome" TEXT NOT NULL,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "documentos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "documentos_electionId_createdAt_idx"
  ON "documentos" ("electionId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'documentos_electionId_fkey'
  ) THEN
    ALTER TABLE "documentos"
      ADD CONSTRAINT "documentos_electionId_fkey"
      FOREIGN KEY ("electionId") REFERENCES "elections"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
