-- CreateEnum
CREATE TYPE "Zona" AS ENUM ('SUL', 'LESTE', 'SUDESTE', 'NORTE', 'CENTRO', 'RURAL');

-- CreateTable
CREATE TABLE "workplaces" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "zona" "Zona" NOT NULL,
    "orgao" TEXT NOT NULL,
    "linkToken" TEXT NOT NULL,
    "dataInicioVotacao" TIMESTAMP(3) NOT NULL,
    "dataFimVotacao" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workplaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidates" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "workplaceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voters" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "telefone" TEXT,
    "matricula" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "votes" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "workplaceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "votes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workplaces_linkToken_key" ON "workplaces"("linkToken");

-- CreateIndex
CREATE INDEX "candidates_workplaceId_idx" ON "candidates"("workplaceId");

-- CreateIndex
CREATE UNIQUE INDEX "voters_cpf_key" ON "voters"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "voters_matricula_key" ON "voters"("matricula");

-- CreateIndex
CREATE INDEX "votes_candidateId_idx" ON "votes"("candidateId");

-- CreateIndex
CREATE INDEX "votes_workplaceId_idx" ON "votes"("workplaceId");

-- AddForeignKey
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_workplaceId_fkey" FOREIGN KEY ("workplaceId") REFERENCES "workplaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_workplaceId_fkey" FOREIGN KEY ("workplaceId") REFERENCES "workplaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
