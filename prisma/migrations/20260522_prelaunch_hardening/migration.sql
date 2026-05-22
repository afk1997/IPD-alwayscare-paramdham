-- Pre-launch hardening migration.
--
-- DB-7 + STO-1 — partial unique index on MediaAsset.storageKey for
-- READY rows, so two assets cannot point at the same Drive file
-- (PENDING rows share `pending:<folderId>` keys; the partial WHERE
-- skips them).
CREATE UNIQUE INDEX IF NOT EXISTS "MediaAsset_storageKey_ready_unique"
  ON "MediaAsset" ("storageKey")
  WHERE "status" = 'READY';

-- DB-3 — partial indexes for the hot patient list / activity feed.
-- The current full indexes still cover ordering, but most production
-- traffic only ever wants live rows. Partial indexes shrink the index
-- size and let the planner skip the deletedAt re-check entirely.

-- Active-patient list (queries.ts: listAnimals)
CREATE INDEX IF NOT EXISTS "Animal_active_admittedAt_idx"
  ON "Animal" ("admittedAt" DESC)
  WHERE "deletedAt" IS NULL AND "dischargedAt" IS NULL AND "deceasedAt" IS NULL;

-- Activity feed (queries.ts: listForAnimal + reports queries)
CREATE INDEX IF NOT EXISTS "Activity_animalId_occurredAt_live_idx"
  ON "Activity" ("animalId", "occurredAt" DESC)
  WHERE "deletedAt" IS NULL;

-- Document listing (queries.ts: listDocumentsForAnimal + listAllDocuments)
CREATE INDEX IF NOT EXISTS "Document_animalId_live_idx"
  ON "Document" ("animalId", "createdAt" DESC)
  WHERE "deletedAt" IS NULL;
