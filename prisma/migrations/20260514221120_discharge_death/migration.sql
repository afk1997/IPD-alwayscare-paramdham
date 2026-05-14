-- CreateTable
CREATE TABLE "DeathRecord" (
    "animalId" TEXT NOT NULL,
    "causeOfDeath" TEXT NOT NULL,
    "diedAt" TIMESTAMP(3) NOT NULL,
    "postmortemDoneAt" TIMESTAMP(3),
    "bodyHandedOverTo" TEXT,
    "bodyHandedOverAt" TIMESTAMP(3),
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeathRecord_pkey" PRIMARY KEY ("animalId")
);

-- CreateTable
CREATE TABLE "DischargeRecord" (
    "animalId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "instructions" TEXT,
    "dischargedAt" TIMESTAMP(3) NOT NULL,
    "dischargedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DischargeRecord_pkey" PRIMARY KEY ("animalId")
);

-- AddForeignKey
ALTER TABLE "DeathRecord" ADD CONSTRAINT "DeathRecord_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeathRecord" ADD CONSTRAINT "DeathRecord_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DischargeRecord" ADD CONSTRAINT "DischargeRecord_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DischargeRecord" ADD CONSTRAINT "DischargeRecord_dischargedById_fkey" FOREIGN KEY ("dischargedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
