-- LINHA DO TEMPO PÚBLICA por local (append-only) + arquivo de resultado por
-- rodada. Aditivo: nenhuma tabela existente é alterada; nada muda na apuração.

CREATE TABLE IF NOT EXISTS "local_eventos" (
  "id"          TEXT NOT NULL,
  "workplaceId" TEXT NOT NULL,
  "anoEleicao"  INTEGER NOT NULL,
  "rodada"      INTEGER NOT NULL DEFAULT 1,
  "tipo"        TEXT NOT NULL,
  "titulo"      TEXT NOT NULL,
  "detalhe"     TEXT,
  "autorNome"   TEXT,
  "snapshot"    JSONB,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "local_eventos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "local_eventos_workplaceId_createdAt_idx"
  ON "local_eventos" ("workplaceId", "createdAt");

-- FK com cascade (o evento some junto com o local, como votos/votantes).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'local_eventos_workplaceId_fkey'
  ) THEN
    ALTER TABLE "local_eventos"
      ADD CONSTRAINT "local_eventos_workplaceId_fkey"
      FOREIGN KEY ("workplaceId") REFERENCES "workplaces"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
