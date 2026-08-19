-- Aviso "encerrando em breve" (push) — controle por local para não repetir.
ALTER TABLE "workplaces"
  ADD COLUMN IF NOT EXISTS "notifEndingSoonSent" BOOLEAN NOT NULL DEFAULT false;
