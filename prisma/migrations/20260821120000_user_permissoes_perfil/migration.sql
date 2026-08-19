-- Permissões granulares por módulo + perfil (foto) + troca de senha no 1º acesso.
-- Aditivo e não destrutivo. A coluna `role` permanece (vestigial) para segurança.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "permissoes" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "fotoUrl" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mustChangePassword" BOOLEAN NOT NULL DEFAULT true;

-- Migra o papel atual (role) para o novo mapa de permissões, preservando o
-- acesso de cada usuário existente exatamente como era.
UPDATE "users" SET "permissoes" =
  '{"dashboard":"EDIT","locais":"EDIT","encerradas":"EDIT","votantes":"EDIT","relatorios":"EDIT","pleitos":"EDIT","auditoria":"EDIT","usuarios":"EDIT","configuracoes":"EDIT"}'::jsonb
  WHERE "role" = 'SUPER_ADMIN';

UPDATE "users" SET "permissoes" =
  '{"dashboard":"EDIT","locais":"EDIT","encerradas":"EDIT","votantes":"EDIT","relatorios":"EDIT","pleitos":"EDIT","auditoria":"EDIT","usuarios":"NONE","configuracoes":"EDIT"}'::jsonb
  WHERE "role" = 'ADMIN';

UPDATE "users" SET "permissoes" =
  '{"dashboard":"VIEW","locais":"EDIT","encerradas":"VIEW","votantes":"VIEW","relatorios":"VIEW","pleitos":"NONE","auditoria":"NONE","usuarios":"NONE","configuracoes":"VIEW"}'::jsonb
  WHERE "role" = 'OPERADOR';

UPDATE "users" SET "permissoes" =
  '{"dashboard":"VIEW","locais":"VIEW","encerradas":"VIEW","votantes":"VIEW","relatorios":"VIEW","pleitos":"VIEW","auditoria":"VIEW","usuarios":"NONE","configuracoes":"VIEW"}'::jsonb
  WHERE "role" = 'AUDITOR';

-- Usuários que JÁ existem têm senha em uso — não forçar troca no 1º acesso.
-- (O default true vale apenas para usuários criados a partir de agora.)
UPDATE "users" SET "mustChangePassword" = false;
