-- Candidato pode NÃO ASSUMIR A VAGA (renúncia, desistência, perda em desempate,
-- inelegibilidade). Quando `renunciou` = true, a apuração pula o candidato e
-- promove o próximo suplente. `renunciaMotivo` guarda o porquê (auditoria/ata).
--
-- Migração NÃO destrutiva (colunas novas com default seguro).
ALTER TABLE "candidates" ADD COLUMN "renunciou" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "candidates" ADD COLUMN "renunciaMotivo" TEXT;
