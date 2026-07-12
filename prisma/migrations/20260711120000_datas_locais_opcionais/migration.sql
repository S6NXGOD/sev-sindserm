-- Janela de votação por LOCAL passa a ser OPCIONAL.
--
-- Regra de negócio nova: o local de trabalho não herda mais as datas do pleito.
-- Ele nasce SEM datas (null = "Não definida" / aguardando visita da diretoria) e
-- só é ativado manualmente, quando o diretor visita o local e agenda início/fim.
--
-- Migração NÃO destrutiva: apenas remove o NOT NULL (alargamento de coluna).
-- Nenhum dado existente é alterado aqui — o reset das datas dos locais já
-- cadastrados é feito à parte, pelo script `prisma/reset-datas-locais.ts`
-- (dry-run por padrão, exige --apply).
ALTER TABLE "workplaces" ALTER COLUMN "dataInicioVotacao" DROP NOT NULL;
ALTER TABLE "workplaces" ALTER COLUMN "dataFimVotacao" DROP NOT NULL;
