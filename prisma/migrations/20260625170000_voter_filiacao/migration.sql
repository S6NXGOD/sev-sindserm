-- Filiação ao SINDSERM declarada pelo eleitor no ato do voto.
ALTER TABLE "voters" ADD COLUMN "isFiliado" BOOLEAN NOT NULL DEFAULT false;
