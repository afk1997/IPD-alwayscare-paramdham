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

-- DB-1: switch Activity.byUserId / Activity.editedById FKs from
-- ON DELETE SET NULL to ON DELETE RESTRICT, so a future hard-delete of
-- a User row cannot silently strip attribution. The application code
-- already enforces deactivate-instead-of-delete; this matches the schema.
ALTER TABLE "Activity"
  DROP CONSTRAINT IF EXISTS "Activity_byUserId_fkey",
  ADD CONSTRAINT "Activity_byUserId_fkey"
    FOREIGN KEY ("byUserId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Activity"
  DROP CONSTRAINT IF EXISTS "Activity_editedById_fkey",
  ADD CONSTRAINT "Activity_editedById_fkey"
    FOREIGN KEY ("editedById") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
