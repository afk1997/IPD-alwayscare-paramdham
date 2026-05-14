# Arham Always Care — IPD App: Design Spec

**Date:** 2026-05-15
**Status:** Draft — pending user review
**Owner:** kaivan@techseva.info

---

## 1. Context

Arham Always Care runs an animal clinic. Staff currently lack a structured way to log inpatient (IPD) activity, track recoveries, and coordinate between rescuers, paramedics, doctors, and reception. This app digitizes the IPD workflow on phones (used on the floor) and desktops (used at reception / admin).

A complete HTML/React prototype was produced via Claude Design and exported to `designs/source/`. The prototype is session-state only — this spec turns it into a persistent, multi-user, role-aware production application.

### Goals
1. **Mobile-first floor capture** — staff log treatments, food, walks on phones in <10 seconds per entry.
2. **Accountable trail** — every entry is signed (who, when), edits are tracked, deletes are soft + restorable.
3. **Role-aware UI** — Staff, Doctor, Admin see scoped affordances; permissions enforced server-side.
4. **Critical-case visibility** — "needs attention" surfaces patients with no update in 6 hours and critical-status patients.
5. **Reports** — daily activity report and per-animal complete report, printable.

### Non-goals (v1)
- Billing, inventory, OPD (outpatient) tracking, appointments, SMS/WhatsApp notifications.
- Multi-clinic / multi-tenant.
- Public-facing animal adoption listings.

---

## 2. Tech stack

| Concern | Choice | Rationale |
|---|---|---|
| Framework | Next.js 15 (App Router) | RSC + Server Actions for mutations; one app for web + mobile responsive |
| Language | TypeScript strict | |
| Database | Postgres 16 (Docker local → Neon prod) | Neon-compatible, no schema rewrite at cutover |
| ORM | Prisma | Type-safe queries, easy migrations |
| Auth | Auth.js v5 (NextAuth) | Credentials + DB sessions; future OAuth optional |
| Styling | Tailwind CSS + CSS variables | Theme variants are pure var swaps (Clinical/Warm/Utility) |
| UI primitives | shadcn/ui (Dialog, Sheet, Dropdown, Popover only) | Custom components for everything else to match design |
| Icons | Lucide | Matches prototype's stroke style |
| Validation | Zod | Shared client + server schemas |
| Forms | React Hook Form | Wizard state + dirty tracking |
| File storage | Local FS (dev) → Google Drive (prod) | Behind a `FileStorage` interface; user has Drive service account ready |
| Background jobs | None in v1 | Stale-update flag computed on read |
| Testing | Vitest (unit), Playwright (e2e) | |

### Why JSON `data` column on Activity
The 7 activity types share `(animalId, type, occurredAt, byUser, remarks, photos)` but diverge sharply in payload (treatment has a medicine list, surgery has duration + complications, food has intake state, etc). The prototype already models this as one object per activity. Per-type tables would force 7 left-joins for every activity feed query. JSON gives us:
- One indexed `Activity` table for feed/pagination.
- Discriminated-union Zod schemas validate `data` at every entry point.
- Trivial to add a new activity type later (just a new schema + form).

### Why server actions instead of REST
Mutations are all internal (no external API consumers). Server actions give us:
- Type-safe RPC without a generated client.
- Forms work without JS (progressive enhancement).
- Built-in revalidation hooks.

File uploads still use a route handler (`/api/files/upload`) because server actions don't stream multipart well.

---

## 3. Data model

### Prisma schema (target)

```prisma
// === Auth ===
model User {
  id              String    @id @default(cuid())
  email           String    @unique
  passwordHash    String
  name            String
  role            Role
  active          Boolean   @default(true)
  invitedById     String?
  invitedAt       DateTime?
  lastLoginAt     DateTime?
  createdAt       DateTime  @default(now())
  // relations
  createdAnimals  Animal[]   @relation("AnimalCreatedBy")
  activities      Activity[] @relation("ActivityBy")
  edits           Activity[] @relation("ActivityEditedBy")
  uploads         MediaAsset[]
  auditLogs       AuditLog[]
  sessions        Session[]
}

enum Role { STAFF DOCTOR ADMIN }

// === Auth.js standard tables (Session, VerificationToken) ===

// === Animals ===
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

  // rescue / owner
  rescuer         String?
  rescuerPhone    String?
  address         String?
  ngo             String?
  broughtBy       String?
  admittedAt      DateTime  @default(now())

  // medical
  complaint       String?
  injuryType      String?
  history         String?
  diagnosis       String?
  surgeryRequired String?
  contagious      Boolean   @default(false)
  status          AnimalStatus @default(OBSERVATION)
  ward            String?

  // tests advised (denormalized — small enum list)
  testsAdvised    AnimalTest[]

  // lifecycle
  dischargedAt    DateTime?
  deceasedAt      DateTime?
  createdById     String
  createdBy       User      @relation("AnimalCreatedBy", fields: [createdById], references: [id])
  editedAt        DateTime?
  editedById      String?
  deletedAt       DateTime?

  // relations
  activities      Activity[]
  documents       Document[]
  media           AnimalMedia[]
  deathRecord     DeathRecord?
  dischargeRecord DischargeRecord?

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([status])
  @@index([admittedAt])
}

enum Gender { MALE FEMALE UNKNOWN }
enum Vaccination { DONE PARTIAL NONE NA }
enum AnimalStatus { CRITICAL STABLE OBSERVATION DISCHARGED DECEASED }

model AnimalTest {
  id        String  @id @default(cuid())
  animalId  String
  animal    Animal  @relation(fields: [animalId], references: [id], onDelete: Cascade)
  test      TestKind
  @@unique([animalId, test])
}

enum TestKind { XRAY USG BLOOD_TEST MRI CT_SCAN SONOGRAPHY }

// === Activities ===
model Activity {
  id           String       @id @default(cuid())
  animalId     String
  animal       Animal       @relation(fields: [animalId], references: [id])
  type         ActivityType
  occurredAt   DateTime     @default(now())
  byUserId     String?
  byUser       User?        @relation("ActivityBy", fields: [byUserId], references: [id])
  byName       String       // snapshotted at write time (allows freelance vets etc.)
  remarks      String?
  data         Json         // discriminated by `type` — validated via Zod
  // edit/delete metadata
  editedAt     DateTime?
  editedById   String?
  editedBy     User?        @relation("ActivityEditedBy", fields: [editedById], references: [id])
  deletedAt    DateTime?
  duplicatedFromId String?

  media        ActivityMedia[]
  createdAt    DateTime     @default(now())

  @@index([animalId, occurredAt])
  @@index([type, occurredAt])
}

enum ActivityType {
  ADMISSION
  TREATMENT
  ROUND
  DIAGNOSTIC
  SURGERY
  FOOD
  BATH
  WALK
}

// === Documents ===
model Document {
  id          String   @id @default(cuid())
  animalId    String
  animal      Animal   @relation(fields: [animalId], references: [id])
  category    DocCategory
  kind        String   // free-text within a category (e.g. "X-ray", "Owner ID", "Postmortem report")
  name        String   // user-facing filename
  fileId      String?
  file        MediaAsset? @relation(fields: [fileId], references: [id])
  uploadedById String
  createdAt   DateTime @default(now())
  deletedAt   DateTime?

  @@index([animalId, category])
}

enum DocCategory { MEDICAL DIAGNOSTICS CONSENT OWNERSHIP DEATH }

// === Media (files) ===
model MediaAsset {
  id            String   @id @default(cuid())
  kind          MediaKind
  filename      String
  mimeType      String
  size          Int
  storageKey    String   // e.g. "uploads/2026-05/abc.jpg" for local, or S3 key
  width         Int?
  height        Int?
  durationSec   Int?     // for video
  uploadedById  String
  uploadedBy    User     @relation(fields: [uploadedById], references: [id])
  createdAt     DateTime @default(now())
}

enum MediaKind { PHOTO VIDEO XRAY DOC }

model AnimalMedia {
  id          String @id @default(cuid())
  animalId    String
  animal      Animal @relation(fields: [animalId], references: [id])
  assetId     String
  asset       MediaAsset @relation(fields: [assetId], references: [id])
  label       String?
  order       Int @default(0)
}

model ActivityMedia {
  id          String @id @default(cuid())
  activityId  String
  activity    Activity @relation(fields: [activityId], references: [id], onDelete: Cascade)
  assetId     String
  asset       MediaAsset @relation(fields: [assetId], references: [id])
  label       String?
}

// === Death & Discharge ===
model DeathRecord {
  animalId          String   @id
  animal            Animal   @relation(fields: [animalId], references: [id])
  causeOfDeath      String
  diedAt            DateTime
  postmortemDoneAt  DateTime?
  bodyHandedOverTo  String?
  bodyHandedOverAt  DateTime?
  recordedById      String
  createdAt         DateTime @default(now())
}

model DischargeRecord {
  animalId          String   @id
  animal            Animal   @relation(fields: [animalId], references: [id])
  summary           String
  instructions      String?
  dischargedAt      DateTime
  dischargedById    String
  createdAt         DateTime @default(now())
}

// === Audit log ===
model AuditLog {
  id          String   @id @default(cuid())
  actorId     String?
  actor       User?    @relation(fields: [actorId], references: [id])
  action      String   // "create", "update", "delete", "restore", "login", etc.
  entityType  String   // "Animal", "Activity", "Document", "User"
  entityId    String
  before      Json?
  after       Json?
  context     Json?    // extra (e.g. ip address, user-agent)
  createdAt   DateTime @default(now())

  @@index([entityType, entityId])
  @@index([actorId, createdAt])
}

// === Settings ===
model ClinicSetting {
  key   String @id   // e.g. "wards", "clinic_name", "default_doctor"
  value Json
}
```

### Zod schema for Activity.data (per-type)

```ts
// lib/activity-schemas.ts
const Treatment = z.object({
  meds: z.array(z.object({
    name: z.string().min(1),
    dose: z.string().min(1),
    route: z.enum(['IV','IM','Oral','SC','Topical']),
    time: z.string().datetime().optional(),
  })).min(1),
});
const Round = z.object({
  temp: z.string().optional(),
  appetite: z.enum(['Refused','Partial','Normal','Eager']).optional(),
  hydration: z.enum(['Severe','Mild','OK','Good']).optional(),
  pain: z.string().optional(),         // e.g. "6/10"
  wound: z.string().optional(),
  stool: z.string().optional(),
  progress: z.string().optional(),
  notes: z.string().optional(),
});
const Diagnostic = z.object({
  tests: z.array(z.enum(['Blood test','X-ray','Sonography','MRI','CT','USG'])).min(1),
  findings: z.string().optional(),
  interpretation: z.string().optional(),
});
const Surgery = z.object({
  surgeryName: z.string().min(1),
  surgeon: z.string().min(1),
  anesthesia: z.string().optional(),
  duration: z.string().optional(),
  findings: z.string().optional(),
  complications: z.string().optional(),
  postOp: z.string().optional(),
});
const Food = z.object({
  foodType: z.string().min(1),
  qty: z.string().optional(),
  water: z.string().optional(),
  intake: z.enum(['Fully','Partially','Refused']),
  vomiting: z.boolean().default(false),
});
const Bath = z.object({
  bathType: z.enum(['Medicated bath','Tick treatment','Wound cleaning','Regular']),
  groomingBy: z.string().optional(),
  remarks: z.string().optional(),
});
const Walk = z.object({
  duration: z.string().optional(),
  urination: z.boolean().default(false),
  stool: z.boolean().default(false),
  mobility: z.string().optional(),
  assisted: z.boolean().default(false),
});
const Admission = z.object({
  summary: z.string().min(1),
});

export const ActivityData = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ADMISSION'),  data: Admission }),
  z.object({ type: z.literal('TREATMENT'),  data: Treatment }),
  z.object({ type: z.literal('ROUND'),      data: Round }),
  z.object({ type: z.literal('DIAGNOSTIC'), data: Diagnostic }),
  z.object({ type: z.literal('SURGERY'),    data: Surgery }),
  z.object({ type: z.literal('FOOD'),       data: Food }),
  z.object({ type: z.literal('BATH'),       data: Bath }),
  z.object({ type: z.literal('WALK'),       data: Walk }),
]);
```

---

## 4. RBAC matrix

| Action | Staff | Doctor | Admin |
|---|---|---|---|
| Create admission | ✓ | ✓ | ✓ |
| Log FOOD / BATH / WALK | ✓ | ✓ | ✓ |
| Log TREATMENT | ✓ (any) | ✓ | ✓ |
| Log ROUND / DIAGNOSTIC / SURGERY | — | ✓ | ✓ |
| Upload documents | ✓ | ✓ | ✓ |
| Edit own entry, ≤24h | ✓ | ✓ | ✓ |
| Edit any entry, any time | — | ✓ | ✓ |
| Soft-delete (restore window 7d) | — | ✓ | ✓ |
| Hard-delete | — | — | ✓ |
| Discharge / record death | — | ✓ | ✓ |
| Manage users (invite/disable/role) | — | — | ✓ |
| View audit log | — | (own actions) | ✓ |
| Clinic settings | — | — | ✓ |
| Override 6h-no-update alert | — | ✓ | ✓ |

Enforcement: `lib/rbac.ts` exports `can(user, action, target?)` that every server action and route handler calls before mutating. Failures throw a typed `RbacError` rendered as a 403 page in the UI.

---

## 5. Service layer + audit

All writes go through `services/*.ts` modules. Each service function follows this signature:

```ts
async function createActivity(actor: User, input: CreateActivityInput): Promise<Activity> {
  if (!can(actor, 'activity.create', input)) throw new RbacError(...);
  const parsed = ActivityData.parse(input);
  return prisma.$transaction(async tx => {
    const activity = await tx.activity.create({ data: { ... } });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: 'create', entityType: 'Activity', entityId: activity.id,
        after: activity,
      },
    });
    return activity;
  });
}
```

Page components and server actions never touch `prisma` directly — they call services. This makes the audit + RBAC enforcement non-bypassable. Tests target the service layer.

---

## 6. File storage (Google Drive)

User will provide a **Google Cloud service account JSON key** and a **destination Drive folder ID** (the service account is added as Editor on that folder). All clinic media lives there.

### Interface (storage driver pattern)

```ts
// lib/storage/index.ts
export interface FileStorage {
  put(buf: Buffer, meta: { filename: string; mime: string }): Promise<PutResult>;
  get(key: string): Promise<{ stream: NodeJS.ReadableStream; mime: string; size: number }>;
  delete(key: string): Promise<void>;
  // For images: a directly-usable URL if the driver can produce one safely.
  // Returns null when the consumer must go through our proxy.
  directUrl(key: string): string | null;
}
type PutResult = { key: string; size: number; width?: number; height?: number; durationSec?: number };
```

**Three drivers**, selected by `STORAGE_DRIVER` env (`local` | `gdrive`):

| Driver | When | Key shape |
|---|---|---|
| `LocalDiskStorage` | Dev | `local:2026-05/abc.jpg` (relative path under `./uploads/`) |
| `GoogleDriveStorage` | Prod | `gdrive:{driveFileId}` (the Drive file ID returned by API) |

Pages **never** reference Drive URLs directly — always `/api/files/[mediaAssetId]?w=...`. That gives us:
- Auth on every download (Drive's public-link sharing would leak photos to anyone with the URL).
- A central place to cache and resize.
- Driver swap with zero UI changes.

### Google Drive integration details

**Auth.** `googleapis` SDK + service account JSON. We don't need domain-wide delegation; the service account just needs to be an editor on the destination folder. Service account JSON is loaded from `GOOGLE_SERVICE_ACCOUNT_JSON` env var (base64-encoded) so it stays out of disk.

**Folder layout** inside the configured root folder (folder ID in `GOOGLE_DRIVE_ROOT_FOLDER_ID`):

```
{root}/
├── animals/{animalId}/
│   ├── admission/
│   ├── activity/{activityId}/
│   └── documents/{docCategory}/
└── _trash/    # soft-deleted items moved here before hard delete
```

Each `MediaAsset` row stores the Drive `fileId` as `storageKey` (prefixed `gdrive:`). The folder hierarchy is purely organizational — the DB always identifies files by `fileId`, so a manual move in Drive won't break links.

**Upload flow:**
1. Client POSTs multipart to `/api/files/upload` with `animalId`, optional `activityId`, optional `category`.
2. Route handler validates auth + RBAC, streams the body into a temp buffer, runs `sharp` for images to extract metadata.
3. Calls `drive.files.create({ name, parents:[targetFolderId], mimeType }, { media: { body: stream }})`.
4. Returns the `MediaAsset` row to the client.

**Download flow** (`/api/files/[id]`):
1. Auth check (must be logged in; for documents, RBAC check).
2. Look up `MediaAsset` in DB.
3. If image with `?w=` query param: check `MediaCache` table (see §7) for resized variant; if miss, fetch from Drive, resize via `sharp`, store cached variant in Drive `_thumbnails/` folder, record in `MediaCache`.
4. Stream the bytes back with `Cache-Control: private, max-age=86400` and an `ETag` on the Drive `fileId`.

**Why we proxy instead of serving Drive URLs directly:**
- Drive's `webContentLink` requires the file be "anyone with link" — leaks photos.
- `uc?export=download&id=...` 302-redirects randomly to varying CDN origins, breaking caching.
- Drive has aggressive rate-limit on per-IP downloads of the same file; our proxy uses long server-side caching so origin requests stay low.

**Rate limits & resilience:**
- Drive API: ~1000 reads/100s/user, ~300 writes. Wrap calls in `p-retry` with exponential backoff + jitter.
- Bulk operations (initial seed or import) use `--background-uploads` flag through a separate queue.
- Upload size limited at the route handler: 25MB images, 200MB video. Larger → return 413.

**Image processing:**
- On upload, `sharp` extracts width/height/exif, writes them onto `MediaAsset`.
- Server-side resize on-demand at proxy time (`?w=256&q=70`), cached.

**Video:**
- Stored as uploaded. First-frame thumbnail generated via `ffmpeg-static` on upload, stored as a sibling `MediaAsset` with `kind=PHOTO` and a `posterFor` FK to the video asset.

**Failure modes & quotas:**
- If Drive is down: upload returns 503, client shows retry; **no DB row is written without a successful upload** (the transaction wraps both).
- 15GB free Drive quota: warn at 80%, block uploads at 95% via a startup check. Doc the upgrade path.
- Service account has no UI presence in regular Drive — users see files only through the app.

---

## 7. Performance, caching, indexes

Every read path is designed with three questions answered up front: **which cache layer holds it, what invalidates that cache, and what index serves the underlying query**. No "let's optimize later" — perf is part of the spec.

### 7.1 Caching layers

Next.js gives us five caches; we use them deliberately, not by accident.

| Layer | Where | What we cache | TTL | Invalidation |
|---|---|---|---|---|
| **Request memoization** (`React.cache`) | Per-request RSC | `getCurrentUser()`, `getAnimal(id)` when called from multiple components in one render | end of request | automatic |
| **Data cache** (`unstable_cache`) | Server, persistent | Tagged queries: animal list, today stats, single animal w/ relations | 60s default, override per query | `revalidateTag()` from server actions |
| **Full route cache** | RSC output | Read-only routes with stable data: `/admin/audit-log` filtered views | route-specific | `revalidatePath()` |
| **Router cache** | Browser, in-memory | Navigations between routes | 30s dynamic / 5min static | client navigations + form submissions |
| **Media proxy cache** | `/api/files/[id]` response headers + `MediaCache` table | Resized image variants | 1d browser, 30d server | manual purge on media delete |

**Tag conventions** (revalidate granularly, never the whole site):
```ts
// Reads tag what they depend on
unstable_cache(fn, ['animals-list'], { tags: ['animals'] })
unstable_cache(fn, ['animal', id], { tags: [`animal:${id}`, 'animals'] })
unstable_cache(fn, ['activities', animalId], { tags: [`animal:${animalId}:activities`] })
unstable_cache(fn, ['today-stats'], { tags: ['today-stats'], revalidate: 60 })

// Writes invalidate the tags they touched
createAnimal:     revalidateTag('animals'); revalidateTag('today-stats')
addActivity:      revalidateTag(`animal:${animalId}:activities`); revalidateTag('today-stats')
editAnimal:       revalidateTag(`animal:${id}`); revalidateTag('animals')
```

Service-layer helper centralizes this — every mutation declares its invalidation tags and the helper calls `revalidateTag` after the transaction commits.

### 7.2 Database indexes (Prisma schema)

Indexes are designed against the **actual query workload**, not "just put one on every FK." Below is the complete index plan keyed to the queries that need them.

| Table | Index | Query it serves |
|---|---|---|
| `Animal` | `@@index([status, admittedAt])` | Today page: critical/observation lists by recency |
| `Animal` | `@@index([admittedAt])` | Patient list default sort |
| `Animal` | `@@index([deletedAt])` | Hide soft-deleted from active list (partial: `WHERE deletedAt IS NULL`) |
| `Animal` | `@@index([species])` | Species filter |
| `Activity` | `@@index([animalId, occurredAt(sort: Desc)])` | Per-animal timeline (covering most reads) |
| `Activity` | `@@index([type, occurredAt])` | Reports by activity type |
| `Activity` | `@@index([occurredAt])` | Today's activities table |
| `Activity` | `@@index([byUserId, occurredAt])` | "My activities today" / audit |
| `Activity` | `@@index([deletedAt])` | Filter out soft-deleted |
| `Document` | `@@index([animalId, category])` | Animal documents tab grouped by category |
| `Document` | `@@index([category, createdAt])` | Cross-animal documents browser |
| `AuditLog` | `@@index([entityType, entityId, createdAt])` | "Show edit history for this animal" |
| `AuditLog` | `@@index([actorId, createdAt])` | "Show actions by user X" |
| `AuditLog` | `@@index([createdAt])` | Date-range filter on admin page |
| `MediaAsset` | `@@index([uploadedById, createdAt])` | User's uploads (admin) |
| `User` | `@@unique([email])` | Login lookup |
| `User` | `@@index([role, active])` | "Active doctors" picker |

**Partial / functional indexes** added via raw migration where Prisma doesn't generate them:

```sql
-- "Animals without update in 6h" — derived flag; we index the join target
CREATE INDEX activity_latest_per_animal
  ON "Activity" ("animalId", "occurredAt" DESC)
  WHERE "deletedAt" IS NULL;

-- Active animals only (excludes discharged/deceased) — used on every list page
CREATE INDEX animal_active
  ON "Animal" ("admittedAt" DESC)
  WHERE "deletedAt" IS NULL AND "dischargedAt" IS NULL AND "deceasedAt" IS NULL;

-- Trigram index for animal name search
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX animal_name_trgm ON "Animal" USING gin (name gin_trgm_ops);
```

### 7.3 Query patterns we follow

**1. Cursor pagination, not OFFSET/LIMIT.** Patient list, activity feeds, audit log:
```ts
{ where: { ...filters }, take: 20, cursor: { id: cursorId }, skip: 1, orderBy: { admittedAt: 'desc' } }
```
OFFSET is forbidden — performance collapses past page 100. Lint rule: ban `skip:` in `prisma.*.findMany` except after `cursor:`.

**2. No N+1, ever.** Lists that show "last activity" pull it in the same query:
```ts
prisma.animal.findMany({
  where: { ... },
  include: {
    activities: { take: 1, orderBy: { occurredAt: 'desc' }, where: { deletedAt: null } },
  },
})
```
A `prisma-relation-loader` lint rule rejects `.then(rows => Promise.all(rows.map(r => prisma...)))` patterns.

**3. Today stats are one query, not seven.** Implemented as a single `prisma.$queryRaw` with conditional aggregations:
```sql
SELECT
  COUNT(*) FILTER (WHERE "admittedAt"::date = CURRENT_DATE)  AS admissions_today,
  COUNT(*) FILTER (WHERE "dischargedAt"::date = CURRENT_DATE) AS discharges_today,
  COUNT(*) FILTER (WHERE "deceasedAt"::date = CURRENT_DATE)   AS deaths_today,
  COUNT(*) FILTER (WHERE status = 'CRITICAL')                 AS critical_count,
  ...
FROM "Animal" WHERE "deletedAt" IS NULL
```
Result wrapped in `unstable_cache(['today-stats'], { tags: ['today-stats'], revalidate: 60 })`.

**4. Stale-update flag is computed in SQL.** Don't fetch all activities to JS:
```sql
SELECT a.id, a.name, MAX(act."occurredAt") AS last_activity
FROM "Animal" a
LEFT JOIN "Activity" act ON act."animalId" = a.id AND act."deletedAt" IS NULL
WHERE a."deletedAt" IS NULL AND a."dischargedAt" IS NULL AND a."deceasedAt" IS NULL
GROUP BY a.id
HAVING MAX(act."occurredAt") < NOW() - INTERVAL '6 hours' OR MAX(act."occurredAt") IS NULL
```

**5. Always project.** Use Prisma `select` to fetch only the columns each view needs. The animal-list query returns ~8 fields, never `*`.

**6. Search uses trigram, not LIKE.** Animal name search on the patient list uses `pg_trgm`:
```sql
WHERE name % $1 ORDER BY similarity(name, $1) DESC LIMIT 20
```
Falls back gracefully when query is <3 chars (returns recent admissions).

### 7.4 Connection management

- `prisma.ts` exports a singleton; in dev wrapped in `globalThis.__prisma` to survive hot reload.
- Prisma client `connection_limit=10` (Neon's pooled connection limit at the free tier is generous, but we want headroom).
- Use Neon **pooled** connection string (`postgres://...?pgbouncer=true&connection_limit=10`) so serverless functions don't exhaust connections.

### 7.5 Image performance

- Client-side resize before upload (`browser-image-compression`) — phones produce 12MP photos we don't need.
- `next/image` everywhere with custom loader → our proxy with `w=` query.
- Responsive `sizes` attribute on every `<Image/>`; lazy-load below the fold (Next.js default).
- LCP target: <2.5s on a mid-range Android over 4G. Each phase's "done when" includes a Lighthouse check.

### 7.6 Bundle & rendering

- Server Components by default; `'use client'` only where it must be (form state, sheets, charts).
- Activity feed virtualizes (`@tanstack/react-virtual`) past 50 rows.
- Date pickers / charts are dynamic-imported with `ssr:false` so they don't bloat the initial JS bundle.
- `next/font` for Plus Jakarta Sans + Inter + JetBrains Mono with `display:'swap'`.

### 7.7 The "MediaCache" table (for image variants)

```prisma
model MediaCache {
  id            String   @id @default(cuid())
  assetId       String
  variant       String   // e.g. "w256_q70"
  storageKey    String   // Drive fileId of the resized file
  size          Int
  createdAt     DateTime @default(now())
  @@unique([assetId, variant])
  @@index([createdAt])
}
```

A periodic admin action ("Purge unused variants") deletes rows older than 30 days where the parent asset hasn't been re-viewed — keeps Drive quota in check.

---

## 8. Theming

Three themes, switchable per-user (preference saved on `User`):

| Theme | Accent | Use case |
|---|---|---|
| Clinical | `#0E7C7B` (teal) | Default — clinical/medical |
| Warm | `#B5471A` (terracotta) | Rescue/community feel |
| Utility | dark mode | Night shift / low light |

Implementation: `:root` defines CSS variables (`--accent`, `--bg`, `--paper`, etc.). Theme switcher updates `data-theme="warm"` on `<html>`; CSS uses `[data-theme="warm"] { --accent: ... }`. No JS recompute needed.

Density (Comfortable / Compact) is also a `data-density` attribute applied to the same root.

Activity-feed style (Timeline / Tabs / Grouped) is a per-user preference rendered conditionally in the AnimalDetail screen.

---

## 9. Code organization & conventions

The prototype is a single-shell-many-screens React file — fine for design, **not** how we ship. Production code is feature-sliced with hard file-size caps and a strict separation between data, UI, and orchestration.

### File-size budget (enforced via ESLint rule + CI)

| Kind | Soft cap | Hard cap | If exceeded |
|---|---|---|---|
| React component | 150 lines | 250 lines | Split into sub-components |
| Server action / service fn | 60 lines | 100 lines | Extract helpers |
| Schema / type file | 200 lines | 300 lines | Split by domain |
| Route page (`page.tsx`) | 80 lines | 120 lines | Move logic to feature/components |

Pages stay thin: a `page.tsx` should be ~30 lines of "fetch data → render `<Feature/>`". All real work lives in features.

### Feature-sliced layout

```
src/
├── app/                              # Next.js routes — thin shells only
│   ├── (auth)/login/page.tsx         # <LoginForm/>
│   ├── (app)/
│   │   ├── layout.tsx                # <AppShell/>
│   │   ├── page.tsx                  # <TodayDashboard/>
│   │   ├── patients/page.tsx         # <PatientList/>
│   │   ├── patients/new/page.tsx     # <AdmissionWizard/>
│   │   └── patients/[id]/page.tsx    # <AnimalDetail/>
│   └── api/files/[id]/route.ts
│
├── features/                         # Vertical slices — one folder per domain
│   ├── animals/
│   │   ├── schema.ts                 # Zod input/output schemas
│   │   ├── service.ts                # Mutations (createAnimal, etc.)
│   │   ├── queries.ts                # Reads (listAnimals, getAnimal)
│   │   ├── rbac.ts                   # Per-action permission checks
│   │   ├── actions.ts                # Server actions (thin wrappers calling service)
│   │   ├── components/
│   │   │   ├── PatientList.tsx
│   │   │   ├── PatientCard.tsx
│   │   │   ├── PatientFilters.tsx
│   │   │   ├── StatusBadge.tsx
│   │   │   ├── FreshnessIndicator.tsx
│   │   │   ├── AnimalDetail.tsx
│   │   │   ├── AnimalDetailTabs.tsx
│   │   │   └── AdmissionWizard/
│   │   │       ├── index.tsx          # Orchestrator only
│   │   │       ├── Step1Basics.tsx
│   │   │       ├── Step2Rescuer.tsx
│   │   │       ├── Step3Medical.tsx
│   │   │       ├── Step4Media.tsx
│   │   │       ├── Step5DoctorNotes.tsx
│   │   │       └── useAdmissionForm.ts
│   │   └── __tests__/
│   │       ├── service.test.ts
│   │       └── schema.test.ts
│   │
│   ├── activities/
│   │   ├── schema.ts                  # Discriminated union root
│   │   ├── service.ts
│   │   ├── queries.ts
│   │   ├── rbac.ts
│   │   ├── actions.ts
│   │   ├── types/                     # ONE folder per activity type
│   │   │   ├── treatment/
│   │   │   │   ├── schema.ts
│   │   │   │   ├── TreatmentForm.tsx
│   │   │   │   ├── TreatmentDisplay.tsx
│   │   │   │   ├── MedicineList.tsx
│   │   │   │   └── MedicineRow.tsx
│   │   │   ├── round/
│   │   │   │   ├── schema.ts
│   │   │   │   ├── RoundForm.tsx
│   │   │   │   └── RoundDisplay.tsx
│   │   │   ├── diagnostic/
│   │   │   ├── surgery/
│   │   │   ├── food/
│   │   │   ├── bath/
│   │   │   └── walk/
│   │   ├── components/                 # Cross-type shared
│   │   │   ├── ActivityTimeline.tsx
│   │   │   ├── ActivityRow.tsx
│   │   │   ├── ActivityQuickAdd.tsx     # Type-picker sheet
│   │   │   └── ActivityActions.tsx      # Edit / duplicate / delete menu
│   │   └── __tests__/
│   │
│   ├── documents/
│   │   ├── schema.ts
│   │   ├── service.ts
│   │   ├── queries.ts
│   │   ├── components/
│   │   │   ├── DocumentList.tsx
│   │   │   ├── DocumentUpload.tsx
│   │   │   ├── DocumentPreview.tsx       # Dispatcher (image/pdf/video)
│   │   │   └── previews/
│   │   │       ├── ImagePreview.tsx
│   │   │       ├── PdfPreview.tsx
│   │   │       └── VideoPreview.tsx
│   │   └── __tests__/
│   │
│   ├── reports/
│   │   ├── queries.ts
│   │   ├── csv.ts
│   │   └── components/
│   │       ├── TodayDashboard.tsx
│   │       ├── DailyActivityReport.tsx
│   │       ├── AnimalCompleteReport.tsx
│   │       └── stats/                   # One component per stat tile
│   │           ├── AdmissionsToday.tsx
│   │           ├── SurgeriesToday.tsx
│   │           ├── CriticalCount.tsx
│   │           └── StaleUpdatesCount.tsx
│   │
│   ├── auth/
│   │   ├── schema.ts
│   │   ├── service.ts
│   │   ├── actions.ts
│   │   └── components/
│   │       ├── LoginForm.tsx
│   │       └── PasswordResetForm.tsx
│   │
│   ├── users/                          # Admin → users
│   │   ├── schema.ts
│   │   ├── service.ts
│   │   ├── queries.ts
│   │   ├── rbac.ts
│   │   └── components/
│   │       ├── UserList.tsx
│   │       ├── InviteUserForm.tsx
│   │       ├── EditUserForm.tsx
│   │       └── RoleBadge.tsx
│   │
│   ├── audit/
│   │   ├── service.ts                   # writeAuditLog used by every service
│   │   ├── queries.ts
│   │   └── components/
│   │       ├── AuditLogTable.tsx
│   │       ├── AuditLogRow.tsx
│   │       └── DiffViewer.tsx
│   │
│   └── settings/
│       ├── schema.ts
│       ├── service.ts
│       └── components/
│           ├── ClinicSettingsForm.tsx
│           ├── WardManager.tsx
│           ├── ThemeSwitcher.tsx
│           └── DensityToggle.tsx
│
├── components/                       # Shared, non-feature UI primitives
│   ├── shell/
│   │   ├── AppShell.tsx
│   │   ├── SideNav.tsx
│   │   ├── BottomNav.tsx
│   │   ├── TopBar.tsx
│   │   ├── SearchBar.tsx
│   │   ├── BrandMark.tsx
│   │   └── useViewport.ts
│   ├── ui/                           # Cross-feature design-system components
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Select.tsx
│   │   ├── Sheet.tsx                 # Wraps shadcn Sheet
│   │   ├── Dialog.tsx
│   │   ├── Chip.tsx
│   │   ├── Pill.tsx
│   │   ├── EmptyState.tsx
│   │   ├── Stepper.tsx               # For wizards
│   │   ├── Toast.tsx
│   │   └── ...                       # one file per primitive, max 100 lines
│   ├── forms/                        # Form helpers used across features
│   │   ├── FormField.tsx             # Label + control + error
│   │   ├── FormSection.tsx
│   │   ├── FileUpload.tsx
│   │   ├── PhotoGrid.tsx
│   │   └── DateTimePicker.tsx
│   └── media/
│       ├── MediaThumbnail.tsx
│       ├── MediaLightbox.tsx
│       └── VideoPlayer.tsx
│
├── lib/                              # Cross-cutting infrastructure
│   ├── prisma.ts                     # Singleton Prisma client
│   ├── auth.ts                       # Auth.js config + getCurrentUser()
│   ├── rbac.ts                       # can(user, action, target) dispatcher
│   ├── storage/
│   │   ├── index.ts                  # FileStorage interface + factory
│   │   ├── local.ts                  # LocalDiskStorage
│   │   └── r2.ts                     # R2Storage (S3 SDK)
│   ├── audit.ts                      # writeAuditLog primitive
│   ├── errors.ts                     # RbacError, ValidationError, NotFoundError
│   ├── result.ts                     # Result<T,E> helper for service returns
│   ├── format.ts                     # Date/number formatters
│   ├── time.ts                       # "4h ago", isStale(animal), etc.
│   └── theme.ts                      # Theme tokens (JS-side mirror of CSS vars)
│
├── styles/
│   ├── globals.css                   # CSS vars per theme, base styles
│   └── tailwind.css
│
└── prisma/
    ├── schema.prisma
    ├── seed.ts
    └── migrations/
```

### The 6 rules every contributor follows

1. **One concept per file.** A component, a hook, a schema — pick one. `PatientList.tsx` does not also define `PatientCard`. If two things always change together, they can share a file; otherwise split.
2. **Pages are dumb.** `app/*/page.tsx` does data-fetch + render one feature component. No business logic, no inline JSX over 30 lines.
3. **No prisma in components.** Components call hooks; hooks call server actions; server actions call services; services call prisma. Skipping a layer = PR rejected.
4. **Co-locate by feature, not by kind.** A treatment form's component, schema, and test live next to each other — not in `/components`, `/schemas`, `/tests`.
5. **No barrel exports** (`index.ts` re-exporting everything). They break tree-shaking and slow type-check. Import the specific path. Exception: `features/*/index.ts` may re-export the public API of the slice (the page-facing component).
6. **Strict TS, no `any`.** `tsc --noEmit` runs in pre-commit and CI. `unknown` + narrowing or a typed error union — never `any`.

### Tooling

- **Biome** (linter + formatter — faster than ESLint+Prettier, single config) with rules: `noExplicitAny`, `noConsoleLog`, `useImportType`, max-lines-per-file, max-params, complexity.
- **TypeScript** strict mode, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`.
- **Husky + lint-staged** pre-commit hook: format → lint → typecheck (only on changed files).
- **CI** runs full typecheck, lint, unit tests, and a "schema-data drift" test that re-validates every `Activity.data` row against the current Zod schema.

### Component decomposition heuristic

If a component handles multiple "things" — a list AND filters AND empty state AND row rendering — extract each into its own file. Example: `PatientList` is the orchestrator (~80 lines); it composes `<PatientFilters/>`, `<PatientCard/>`, `<EmptyState/>`, `<PatientListSkeleton/>`. Each child file stays under 150 lines.

Per-activity-type forms are the clearest illustration: the prototype has them all in one 879-line `screens-forms.jsx`. We split into one folder per type (`features/activities/types/treatment/`, `.../round/`, etc.), each with its own schema, form component, and read-only display component. Adding an 8th type later means adding a folder — never touching existing ones.

---

## 10. Routing

```
app/
  (auth)/
    login/page.tsx
    forgot/page.tsx
    reset/[token]/page.tsx
  (app)/
    layout.tsx                 # AppShell — sidenav on ≥760px, bottomnav below
    page.tsx                   # Today / home
    patients/
      page.tsx                 # list with filters
      new/page.tsx             # 5-step wizard
      [id]/
        page.tsx               # detail (tabs)
        edit/page.tsx
        discharge/page.tsx
        death/page.tsx
        activity/[actId]/edit/page.tsx
        documents/upload/page.tsx
    activity/
      new/page.tsx             # quick-add — ?animal=&type=
    documents/page.tsx         # cross-animal browser
    reports/
      page.tsx                 # landing
      today/page.tsx           # date-picker report
      animal/[id]/page.tsx     # printable full report
    admin/
      users/page.tsx
      users/new/page.tsx
      users/[id]/edit/page.tsx
      audit-log/page.tsx
      settings/page.tsx        # clinic info, wards, etc.
    settings/page.tsx          # personal: theme, density, password
  api/
    files/upload/route.ts      # POST multipart
    files/[id]/route.ts        # GET (proxied download w/ auth)
    auth/[...nextauth]/route.ts
```

---

## 11. Phase plan

### Phase 0 — Foundation
- `pnpm create next-app` + Tailwind + Prisma + Auth.js + Zod + RHF + Lucide
- Docker Compose for local Postgres
- Brand tokens → `globals.css` + `tailwind.config.ts`
- `AppShell` matching prototype (SideNav ≥760, BottomNav < 760, drawer)
- Theme switcher (Clinical/Warm/Utility) on `<html>` via cookie
- Auth.js with credentials provider, hashed passwords, DB session
- Seed script that ports the prototype's 6 animals + activities for dev

**Done when:** can log in, see the Today page (empty stats), switch themes, layout responds at 760px.

### Phase 1 — Animals & Admission
- Prisma migration for `Animal`, `AnimalTest`, `MediaAsset`, `AnimalMedia`
- `services/animals.ts` with `create/update/list/get`, audit-logged
- 5-step admission wizard (RHF) — basics → rescuer → medical → media → doctor notes
- Photo/video upload via `/api/files/upload` (local FS adapter)
- Patient list with search, status/species filter, freshness ("4h ago" — derived from latest activity)
- Animal detail page with three tabs (Activity stub, Details, Documents stub)
- "6h no update" badge — computed at query time

**Done when:** can admit a new animal end-to-end including photos, see them in the list, view the detail page.

### Phase 2 — Activity feed
- Prisma migration for `Activity`, `ActivityMedia`
- `services/activities.ts` with `create/edit/softDelete/restore/duplicate`
- Per-type form components (Treatment, Round, Diagnostic, Surgery, Food, Bath, Walk)
  - Treatment supports multiple-medicine entries
  - Diagnostic supports multi-test selection
- Timeline feed component on AnimalDetail (matches prototype's Timeline view)
- Quick-add sheet from FAB / SideNav "New entry" button — picks animal + activity type then renders the per-type form
- Edit / soft-delete / duplicate with toast + undo (5s)

**Done when:** can log all 7 activity types, see them in the timeline, edit/delete with audit trail.

### Phase 3 — Documents
- Prisma migration for `Document`
- `services/documents.ts` with category-tagged upload
- Documents tab on AnimalDetail — category sections (Medical / Diagnostics / Consent / Ownership / Death)
- Inline preview: image via `<img>` + lightbox; PDF via `<object>`; video via `<video>`
- Cross-animal browser at `/documents` (admin/doctor only)

**Done when:** can upload categorized docs, view them per animal and globally.

### Phase 4 — Today summary & Reports
- Today page real data: admissions today, surgeries today, discharges today, deaths today, critical count, stale-update count
- "Needs attention" list (Critical + stale)
- Reports landing
- Today's activity report — date picker, type filter, table sorted by time, CSV export
- Per-animal complete report — printable layout (CSS `@page` rules)

**Done when:** dashboard reflects real DB state; reports export and print correctly.

### Phase 5 — Discharge & Death flows
- Discharge form: summary, instructions, sets `dischargedAt`, flips status to DISCHARGED
- Death form: cause of death, time, postmortem upload (auto-creates Document with DEATH category), body handover details
- Both flows create an Activity row + a DeathRecord/DischargeRecord row
- Discharged/Deceased animals hidden from active list by default; toggle to show

**Done when:** complete discharge and death flows with proper audit trail and document attachments.

### Phase 6 — Admin
- User management: list, invite (email + temp password), disable, change role
- Audit log viewer: filter by entity type, actor, date range; expandable JSON diff per row
- Clinic settings: wards list, species presets, default doctor names, clinic name + logo
- Personal settings: theme, density, activity-feed style, password change

**Done when:** admin can fully self-serve user lifecycle and view all changes through the audit log.

### Phase 7 — Hardening + Neon cutover
- Empty/error/loading states across all pages
- Mobile gesture polish (swipe-to-delete on activity rows, pull-to-refresh)
- Accessibility audit (focus states, ARIA labels, color contrast)
- Playwright e2e: login → admit → log activity → discharge happy path
- Performance: image lazy-loading, list virtualization if >100 patients
- Switch `DATABASE_URL` to Neon (pooled connection string), run `prisma migrate deploy`
- Switch `STORAGE_DRIVER=gdrive`; set `GOOGLE_SERVICE_ACCOUNT_JSON` (base64) and `GOOGLE_DRIVE_ROOT_FOLDER_ID`; smoke-test upload + proxy download + variant cache

**Done when:** deployable to production behind a domain with all v1 features.

---

## 12. Risks & open decisions

| Risk | Mitigation |
|---|---|
| `data` JSON column drifts from Zod schema | All writes go through services that validate; CI test re-validates every stored row against current schemas |
| Soft delete leaks data to lower roles | Service layer always filters `deletedAt IS NULL` unless caller is admin |
| Local FS storage breaks on Vercel (serverless = ephemeral FS) | Phase 7 migrates to Google Drive driver before any prod deploy. Dev uses local FS only. |
| Large photo/video upload from phones | Client-side resize via `browser-image-compression` (max 2048px, 1.5MB target) before upload; videos accepted up to 200MB with progress indicator |
| Audit log table grows fast | Add monthly partition once we hit ~1M rows; not needed for v1 |
| Concurrent edits to same animal | `updatedAt` is checked on edit; conflict prompts UI to refresh |
| Google Drive 15GB free quota fills up | Startup probe + dashboard tile; warn ≥80%, block uploads ≥95% with clear upgrade path (Workspace plan) |
| Google Drive API rate limit (1000 reads/100s) | `p-retry` with backoff; `MediaCache` table holds resized variants so origin reads stay low |
| Service account JSON leaks | Stored only as `GOOGLE_SERVICE_ACCOUNT_JSON` base64 env var; never in repo; rotate via `.env.production` redeploy |
| Cache staleness after writes | Service-layer `invalidate()` helper called inside the transaction's `onCommit` — guarantees consistency |
| N+1 regressions creep in | Prisma `log: ['query']` in dev + a lint rule banning `.then(rows => Promise.all(rows.map(r => prisma...)))` patterns |

**Open decisions for the user to confirm (defaults assumed if no response):**
- Default theme on first login: **Clinical** (teal). Confirm or change.
- Restore window for soft-deleted activities: **7 days**, then hard-deleted via cron. Confirm.
- Edit window for staff on own activities: **24 hours**. Confirm.
- Login flow: **email + password** with admin-issued temp password on invite (no public signup). Confirm.
- Client-side image resize cap: **2048px / 1.5MB target** before upload. Confirm.
- `unstable_cache` default TTL: **60s** for lists, **300s** for static reference data (wards, doctor names). Confirm.

**User to provide before Phase 7:**
- Google Cloud service account JSON key (we'll base64 it into `GOOGLE_SERVICE_ACCOUNT_JSON`).
- Drive folder ID where the service account has Editor access (set `GOOGLE_DRIVE_ROOT_FOLDER_ID`).
- Neon database connection string (pooled).

---

## 13. Out of scope (explicitly deferred)

- WhatsApp/SMS notifications to rescuers
- Donor / billing module
- Inventory (medicine stock)
- OPD (outpatient) workflows
- Multi-clinic / multi-tenant
- Public-facing adoption listings
- Animal kinship / family tree
- ML triage suggestions

These can be added in v2 once the core IPD flow is stable.

---

## 14. Spec self-review

- [x] Placeholder scan — no TBDs or vague sections remain.
- [x] Internal consistency — data model matches RBAC matrix matches phase scope.
- [x] Scope check — phased into 8 deliverable chunks; each phase has a clear "done when" gate.
- [x] Ambiguity check — JSON-vs-table decision explicit; storage abstraction explicit; theme switching explicit; soft-delete windows specified.

Open items are listed as user confirmations in §12 (with defaults).
