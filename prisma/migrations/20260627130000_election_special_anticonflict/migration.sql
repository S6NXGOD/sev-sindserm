-- Eleições especiais/suplementares: o ano deixa de ser ÚNICO no banco.
-- A unicidade do pleito REGULAR por ano passa a ser garantida na aplicação
-- (trava anti-conflito), permitindo que pleitos especiais coexistam no mesmo ano.
DROP INDEX "elections_ano_key";

-- Marca eleições especiais/suplementares (ignoram a trava anti-conflito de ano).
ALTER TABLE "elections" ADD COLUMN "isEleicaoEspecial" BOOLEAN NOT NULL DEFAULT false;

-- Mantém a busca por ano performática (agora como índice NÃO-único).
CREATE INDEX "elections_ano_idx" ON "elections"("ano");
