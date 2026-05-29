-- AlterTable
ALTER TABLE "DeathRecord" ADD COLUMN "invalidatedAt" TIMESTAMP(3);
ALTER TABLE "DeathRecord" ADD COLUMN "invalidatedById" TEXT;
ALTER TABLE "DischargeRecord" ADD COLUMN "invalidatedAt" TIMESTAMP(3);
ALTER TABLE "DischargeRecord" ADD COLUMN "invalidatedById" TEXT;

-- AddForeignKey
ALTER TABLE "DeathRecord" ADD CONSTRAINT "DeathRecord_invalidatedById_fkey" FOREIGN KEY ("invalidatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DischargeRecord" ADD CONSTRAINT "DischargeRecord_invalidatedById_fkey" FOREIGN KEY ("invalidatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
