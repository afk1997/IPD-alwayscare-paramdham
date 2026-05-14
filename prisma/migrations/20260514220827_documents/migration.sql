-- CreateEnum
CREATE TYPE "DocCategory" AS ENUM ('MEDICAL', 'DIAGNOSTICS', 'CONSENT', 'OWNERSHIP', 'DEATH');

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "category" "DocCategory" NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fileId" TEXT,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Document_animalId_category_idx" ON "Document"("animalId", "category");

-- CreateIndex
CREATE INDEX "Document_category_createdAt_idx" ON "Document"("category", "createdAt");

-- CreateIndex
CREATE INDEX "Document_deletedAt_idx" ON "Document"("deletedAt");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
