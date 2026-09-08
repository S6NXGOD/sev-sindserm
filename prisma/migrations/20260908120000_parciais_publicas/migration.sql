-- Apuração ao vivo no portal público (parcial por candidato de locais abertos).
-- Padrão FALSE (seguro): parciais só aparecem quando o local encerra.
ALTER TABLE "elections"
  ADD COLUMN IF NOT EXISTS "parciaisPublicas" BOOLEAN NOT NULL DEFAULT false;
