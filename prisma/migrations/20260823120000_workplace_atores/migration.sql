-- Rastro de "quem fez" no proprio local (criou/agendou/encerrou). Aditivo.
ALTER TABLE "workplaces"
  ADD COLUMN IF NOT EXISTS "criadoPorId"      TEXT,
  ADD COLUMN IF NOT EXISTS "criadoPorNome"    TEXT,
  ADD COLUMN IF NOT EXISTS "agendadoPorId"    TEXT,
  ADD COLUMN IF NOT EXISTS "agendadoPorNome"  TEXT,
  ADD COLUMN IF NOT EXISTS "agendadoEm"       TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "encerradoPorId"   TEXT,
  ADD COLUMN IF NOT EXISTS "encerradoPorNome" TEXT,
  ADD COLUMN IF NOT EXISTS "encerradoEm"      TIMESTAMP(3);
