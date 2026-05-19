/*
  Warnings:

  - Added the required column `updatedAt` to the `MediaAsset` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "MediaStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

-- AlterTable
ALTER TABLE "MediaAsset" ADD COLUMN     "originalFilename" TEXT,
ADD COLUMN     "status" "MediaStatus" NOT NULL DEFAULT 'READY',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "DriveFolder" (
    "key" TEXT NOT NULL,
    "driveFolderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriveFolder_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "MediaAsset_status_idx" ON "MediaAsset"("status");
