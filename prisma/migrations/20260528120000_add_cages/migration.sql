-- AlterTable
ALTER TABLE "Animal" ADD COLUMN     "cageId" TEXT;

-- CreateTable
CREATE TABLE "Cage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Cage_name_key" ON "Cage"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Animal_cageId_key" ON "Animal"("cageId");

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_cageId_fkey" FOREIGN KEY ("cageId") REFERENCES "Cage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
