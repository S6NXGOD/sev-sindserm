-- Configurações GLOBAIS do sistema (Singleton: 1 registro, id fixo 'global').
-- Independente dos Pleitos (Election) — alterar aqui nunca afeta dados de pleito.
CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "loginLogoUrl" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);
