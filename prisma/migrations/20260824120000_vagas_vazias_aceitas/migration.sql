-- Decisão "manter assim" (vagas sem eleito aceitas / finalizado sem suplementar).
ALTER TABLE "workplaces"
  ADD COLUMN IF NOT EXISTS "vagasVaziasAceitas" BOOLEAN NOT NULL DEFAULT false;
