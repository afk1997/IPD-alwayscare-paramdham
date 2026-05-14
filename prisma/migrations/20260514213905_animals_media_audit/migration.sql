-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "Vaccination" AS ENUM ('DONE', 'PARTIAL', 'NONE', 'NA');

-- CreateEnum
CREATE TYPE "AnimalStatus" AS ENUM ('CRITICAL', 'STABLE', 'OBSERVATION', 'DISCHARGED', 'DECEASED');

-- CreateEnum
CREATE TYPE "TestKind" AS ENUM ('XRAY', 'USG', 'BLOOD_TEST', 'MRI', 'CT_SCAN', 'SONOGRAPHY');

-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('PHOTO', 'VIDEO', 'XRAY', 'DOC');

-- CreateTable
CREATE TABLE "Animal" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "species" TEXT NOT NULL,
    "breed" TEXT,
    "gender" "Gender",
    "ageText" TEXT,
    "color" TEXT,
    "weightKg" DECIMAL(7,2),
    "vaccination" "Vaccination" NOT NULL DEFAULT 'NONE',
    "sterilized" BOOLEAN NOT NULL DEFAULT false,
    "aggressive" BOOLEAN NOT NULL DEFAULT false,
    "rescuer" TEXT,
    "rescuerPhone" TEXT,
    "address" TEXT,
    "ngo" TEXT,
    "broughtBy" TEXT,
    "admittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "complaint" TEXT,
    "injuryType" TEXT,
    "history" TEXT,
    "diagnosis" TEXT,
    "surgeryRequired" TEXT,
    "contagious" BOOLEAN NOT NULL DEFAULT false,
    "status" "AnimalStatus" NOT NULL DEFAULT 'OBSERVATION',
    "ward" TEXT,
    "dischargedAt" TIMESTAMP(3),
    "deceasedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "editedAt" TIMESTAMP(3),
    "editedById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Animal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnimalTest" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "test" "TestKind" NOT NULL,

    CONSTRAINT "AnimalTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "kind" "MediaKind" NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "durationSec" INTEGER,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnimalMedia" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "label" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'admission',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnimalMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "context" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Animal_status_admittedAt_idx" ON "Animal"("status", "admittedAt");

-- CreateIndex
CREATE INDEX "Animal_admittedAt_idx" ON "Animal"("admittedAt");

-- CreateIndex
CREATE INDEX "Animal_species_idx" ON "Animal"("species");

-- CreateIndex
CREATE INDEX "Animal_deletedAt_idx" ON "Animal"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AnimalTest_animalId_test_key" ON "AnimalTest"("animalId", "test");

-- CreateIndex
CREATE INDEX "MediaAsset_uploadedById_createdAt_idx" ON "MediaAsset"("uploadedById", "createdAt");

-- CreateIndex
CREATE INDEX "AnimalMedia_animalId_order_idx" ON "AnimalMedia"("animalId", "order");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalTest" ADD CONSTRAINT "AnimalTest_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalMedia" ADD CONSTRAINT "AnimalMedia_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalMedia" ADD CONSTRAINT "AnimalMedia_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
