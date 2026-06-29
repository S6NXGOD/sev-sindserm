-- Pleito/eleição com logos isoladas por triênio.
CREATE TABLE "elections" (
    "id" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "titulo" TEXT,
    "logoSindsermUrl" TEXT,
    "logoPleitoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "elections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "elections_ano_key" ON "elections"("ano");
