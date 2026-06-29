-- AlterTable: limite de votos do local (null = ilimitado)
ALTER TABLE "workplaces" ADD COLUMN "voteLimit" INTEGER;

-- AlterTable: protocolo do comprovante de votação
ALTER TABLE "voters" ADD COLUMN "protocolo" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "voters_protocolo_key" ON "voters"("protocolo");
