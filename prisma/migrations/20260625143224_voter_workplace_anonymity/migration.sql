/*
  Warnings:

  - You are about to drop the column `createdAt` on the `votes` table. All the data in the column will be lost.
  - Added the required column `workplaceId` to the `voters` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "voters" ADD COLUMN     "workplaceId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "votes" DROP COLUMN "createdAt";

-- CreateIndex
CREATE INDEX "voters_workplaceId_idx" ON "voters"("workplaceId");

-- AddForeignKey
ALTER TABLE "voters" ADD CONSTRAINT "voters_workplaceId_fkey" FOREIGN KEY ("workplaceId") REFERENCES "workplaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
