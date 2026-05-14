# Phase 1 — Animals & Admission Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admit an animal end-to-end through a 5-step wizard with photo/video upload, list patients with filters + freshness, view animal detail.

**Architecture:** Extend the Prisma schema with `Animal`, `AnimalTest`, `MediaAsset`, `AnimalMedia`, `AuditLog`. Add `lib/storage` (local-FS driver, gdrive stub for Phase 7), `lib/rbac.ts`, `lib/audit.ts`. Build `features/animals/` slice with `service`, `queries`, `actions`, `components`. UI uses our existing AppShell + UI primitives.

**Tech Stack:** Next.js Server Actions, Prisma, Zod, React Hook Form, sharp for image meta.

---

## File structure (delta vs Phase 0)

```
src/
├── app/(app)/
│   ├── patients/
│   │   ├── page.tsx                # <PatientList/>
│   │   ├── new/page.tsx            # <AdmissionWizard/>
│   │   └── [id]/page.tsx           # <AnimalDetail/>
│   └── api/files/
│       ├── upload/route.ts         # POST multipart
│       └── [id]/route.ts           # GET (auth + stream)
├── features/animals/
│   ├── schema.ts                   # zod
│   ├── service.ts                  # createAnimal, getAnimal
│   ├── queries.ts                  # listAnimals (with filters), countByStatus
│   ├── rbac.ts                     # can(actor, action, target)
│   ├── actions.ts                  # server actions
│   ├── components/
│   │   ├── PatientList.tsx
│   │   ├── PatientCard.tsx
│   │   ├── PatientFilters.tsx
│   │   ├── StatusBadge.tsx
│   │   ├── FreshnessIndicator.tsx
│   │   ├── AnimalDetail.tsx
│   │   ├── AnimalDetailTabs.tsx
│   │   └── AdmissionWizard/
│   │       ├── index.tsx
│   │       ├── Step1Basics.tsx
│   │       ├── Step2Rescuer.tsx
│   │       ├── Step3Medical.tsx
│   │       ├── Step4Media.tsx
│   │       ├── Step5DoctorNotes.tsx
│   │       └── useAdmissionForm.ts
│   └── __tests__/{schema,service}.test.ts
├── features/media/
│   ├── service.ts                  # createMediaAsset
│   └── components/
│       ├── PhotoGrid.tsx
│       └── PhotoUploadArea.tsx
├── lib/
│   ├── audit.ts                    # writeAuditLog
│   ├── rbac.ts                     # central can() dispatcher
│   ├── time.ts                     # relative time, isStale
│   └── storage/
│       ├── index.ts                # FileStorage interface + factory
│       └── local.ts                # LocalDiskStorage
└── components/ui/
    ├── Stepper.tsx
    ├── EmptyState.tsx
    ├── Input.tsx                   # styled input wrapper
    └── Select.tsx
```

---

## Task 1: Prisma schema extension (Animals + Media + Audit)

- [ ] **Step 1:** Append to `prisma/schema.prisma`:

```prisma
enum Gender { MALE FEMALE UNKNOWN }
enum Vaccination { DONE PARTIAL NONE NA }
enum AnimalStatus { CRITICAL STABLE OBSERVATION DISCHARGED DECEASED }
enum TestKind { XRAY USG BLOOD_TEST MRI CT_SCAN SONOGRAPHY }
enum MediaKind { PHOTO VIDEO XRAY DOC }

model Animal {
  id              String    @id @default(cuid())
  name            String
  species         String
  breed           String?
  gender          Gender?
  ageText         String?
  color           String?
  weightKg        Decimal?  @db.Decimal(7,2)
  vaccination     Vaccination @default(NONE)
  sterilized      Boolean   @default(false)
  aggressive      Boolean   @default(false)
  rescuer         String?
  rescuerPhone    String?
  address         String?
  ngo             String?
  broughtBy       String?
  admittedAt      DateTime  @default(now())
  complaint       String?
  injuryType      String?
  history         String?
  diagnosis       String?
  surgeryRequired String?
  contagious      Boolean   @default(false)
  status          AnimalStatus @default(OBSERVATION)
  ward            String?
  dischargedAt    DateTime?
  deceasedAt      DateTime?
  createdById     String
  createdBy       User      @relation("AnimalCreatedBy", fields: [createdById], references: [id])
  editedAt        DateTime?
  editedById      String?
  deletedAt       DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  testsAdvised    AnimalTest[]
  media           AnimalMedia[]
  @@index([status, admittedAt])
  @@index([admittedAt])
  @@index([species])
  @@index([deletedAt])
}

model AnimalTest {
  id        String   @id @default(cuid())
  animalId  String
  animal    Animal   @relation(fields: [animalId], references: [id], onDelete: Cascade)
  test      TestKind
  @@unique([animalId, test])
}

model MediaAsset {
  id            String    @id @default(cuid())
  kind          MediaKind
  filename      String
  mimeType      String
  size          Int
  storageKey    String
  width         Int?
  height        Int?
  durationSec   Int?
  uploadedById  String
  uploadedBy    User      @relation("MediaUploadedBy", fields: [uploadedById], references: [id])
  createdAt     DateTime  @default(now())
  animalMedia   AnimalMedia[]
  @@index([uploadedById, createdAt])
}

model AnimalMedia {
  id          String     @id @default(cuid())
  animalId    String
  animal      Animal     @relation(fields: [animalId], references: [id], onDelete: Cascade)
  assetId     String
  asset       MediaAsset @relation(fields: [assetId], references: [id], onDelete: Cascade)
  label       String?
  order       Int        @default(0)
  source      String     @default("admission")
  createdAt   DateTime   @default(now())
  @@index([animalId, order])
}

model AuditLog {
  id          String    @id @default(cuid())
  actorId     String?
  actor       User?     @relation("AuditActor", fields: [actorId], references: [id])
  action      String
  entityType  String
  entityId    String
  before      Json?
  after       Json?
  context     Json?
  createdAt   DateTime  @default(now())
  @@index([entityType, entityId])
  @@index([actorId, createdAt])
}
```

Also add to the `User` model:
```prisma
  createdAnimals  Animal[]     @relation("AnimalCreatedBy")
  uploads         MediaAsset[] @relation("MediaUploadedBy")
  auditLogs       AuditLog[]   @relation("AuditActor")
```

- [ ] **Step 2:** Run migration: `pnpm run db:migrate -- --name animals_media_audit`

- [ ] **Step 3:** Commit.

---

## Task 2: lib/storage (local FS driver)

- [ ] Create `src/lib/storage/index.ts` (interface + factory) and `src/lib/storage/local.ts` (LocalDiskStorage). See spec §6.

## Task 3: lib/audit + lib/rbac + lib/time

- [ ] `lib/audit.ts`: `writeAuditLog(tx, {actorId, action, entityType, entityId, before, after, context})`.
- [ ] `lib/rbac.ts`: `can(actor, action, target?)` with dispatch table covering all P1 actions.
- [ ] `lib/time.ts`: `relativeTime(date)`, `isStale(lastActivity, hours=6)`.

## Task 4: features/animals/schema.ts

- [ ] Zod schema for `CreateAnimalInput` covering all admission fields.

## Task 5: features/animals/service.ts + tests

- [ ] `createAnimal(actor, input)`: validates, RBAC, inserts in transaction, writes audit log.
- [ ] Test: hash from input → animal row + audit row exist.

## Task 6: features/animals/queries.ts

- [ ] `listAnimals({ status?, species?, search?, cursor? })` with the partial-index-aware filter.
- [ ] `getAnimal(id)` including media + tests.
- [ ] `countByStatus()` aggregated.
- [ ] Wrap reads in `unstable_cache` with tags `animals`, `animal:{id}`.

## Task 7: API routes (/api/files/upload, /api/files/[id])

- [ ] POST handler validates auth, parses multipart (use `request.formData()`), runs sharp for images, stores via `FileStorage`, returns `MediaAsset` JSON.
- [ ] GET handler validates auth, reads `MediaAsset`, streams from storage with `Cache-Control: private, max-age=86400`.

## Task 8: AdmissionWizard (5 steps)

- [ ] `useAdmissionForm` hook (RHF + step nav).
- [ ] Steps 1–5: Basics, Rescuer, Medical, Media (upload to `/api/files/upload`), Doctor notes.
- [ ] `Stepper` UI primitive showing 1/5..5/5.
- [ ] Submit → `createAnimalAction` server action → redirects to `/patients/[id]`.

## Task 9: PatientList + filters + freshness

- [ ] Server component fetches via `listAnimals`.
- [ ] Filters: species chips, status chips, search input (controlled via `?q=&status=`).
- [ ] `<PatientCard>` shows name, status pill, freshness, ward, age, photo thumbnail.

## Task 10: AnimalDetail page

- [ ] Tabs: Activity (stub "no activities yet"), Details, Documents (stub).
- [ ] Details shows all admission fields.
- [ ] Photo gallery using AnimalMedia.

## Task 11: TodayDashboard wired to real data

- [ ] Replace stubs with real counts from `countByStatus` / `countToday`.
- [ ] "Needs attention" list — animals with `isStale` true OR status=CRITICAL.

## Task 12: E2E happy path + commit

- [ ] Playwright: login → /patients/new → fill steps → submit → land on detail → name shows.
- [ ] Add fixtures + cleanup hook.

---

## Done-when checklist
- [ ] Build / typecheck / lint / unit / e2e all green
- [ ] Admit Bruno via wizard → see him in patient list and detail page
- [ ] Stale indicator shows "—" for new animal, "5m ago" after first activity
- [ ] Audit log records the admission
