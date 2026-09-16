-- DISPENSA (opt-out) de local: a diretoria declara que o local NAO tera
-- representacao (nao sera visitado / optaram por nao ter representante).
-- Aditivo e retrocompativel: por padrao false (nenhum local dispensado).

ALTER TABLE "workplaces"
  ADD COLUMN IF NOT EXISTS "semRepresentacao" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "workplaces"
  ADD COLUMN IF NOT EXISTS "semRepresentacaoMotivo" TEXT;
