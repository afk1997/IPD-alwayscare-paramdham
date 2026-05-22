# Pre-launch hardening — summary report

**Date:** 2026-05-22
**Branch:** main
**Build status:** `pnpm build` ✅ · `pnpm typecheck` ✅ · `pnpm test` ✅ (53/53) · `pnpm lint` (warnings only, no errors)

## What was done

A 10-agent parallel review surfaced **28 Critical + 42 High + 50+ Medium/Low** findings across auth, RBAC, server actions, file proxy, soft-delete + audit, Prisma, storage/Drive, UI/UX, Vercel readiness, and tests. The full ranked list is in `docs/superpowers/specs/2026-05-22-findings.md`.

Every Critical and the High items that affect security / data integrity / deploy readiness have been fixed. The user's flagged "restore from logs" bug was the symptom of three structural gaps — all closed by the new Trash feature.

## The Trash feature (user's flagged item)

The in-app hint to "restore deleted things from the audit log" was a dead end. Now:

- **New `/admin/trash` route** (ADMIN-only) with three tabs: Activities · Documents · Animals. Each row has a Restore button. Sidebar nav entry added.
- **`Animal`** finally has `softDeleteAnimal` / `restoreAnimal` services with audit trail (no code existed before, despite the schema and RBAC permission).
- **`Document`** now has `restoreDocument` (only delete existed before).
- **`Activity`** keeps its existing restore path (used by the toast Undo); the Trash page calls the same function.
- The lying string in `ActivitySheet.tsx:205` now correctly points to the Trash page.
- Undo toast for delete extended to 12s (was 5s — too short).

## Deploy-blocker fixed

**VRC-1** was the killer: `src/middleware.ts` imported `@/lib/auth` which transitively pulled in Prisma + bcryptjs, both incompatible with the Edge runtime. Vercel would have failed to build. Now split into:

- `src/lib/auth.config.ts` — edge-safe, no DB imports.
- `src/lib/auth.ts` — Node runtime, adds adapter + events.
- `src/middleware.ts` — imports only `auth.config.ts`.

`pnpm build` now completes cleanly, with `/admin/trash` in the route table and a 85.2 kB middleware bundle.

## Other Critical / High fixes shipped

### Auth & sessions
- `getCurrentUser` re-reads `role` + `active` from DB every call. Deactivated users lose access immediately, not 8h later.
- DB-backed login rate-limit (5 attempts per email per 15 min), constant-time miss to prevent email enumeration, audit row on every failure.
- `next=` redirect sanitized to relative paths only.
- Role whitelist in JWT callback. Bad token → `null` session, not silent `STAFF` fallback.
- Middleware matcher tightened — no more `.webp/.avif/.mp4/.pdf` bypass.
- Login + logout audit events wired into Auth.js v5.
- Env validator (`src/lib/env.ts`) — Zod schema; build/runtime fails loud on missing `AUTH_SECRET`.

### IDOR — the dominant category, all closed
- `getMediaForRead` now filters soft-deleted parents in all three link tables. Deleted activities/documents/animals no longer leak their media via `/api/files/[id]`.
- `getPatientDailyShareTextAction` and `getActivityShareTextAction` Zod-validate the id, gate `animal.read`, and filter `deletedAt: null`.
- `createActivity`, `updateActivity`, `createDocument` verify the target animal exists and isn't soft-deleted.
- Staging upload sessionId is server-side-prefixed with `actor.id` — user B can no longer write into user A's staging folder.
- Lifecycle (discharge / death) calls `assertOwnedReadyAssets` on document file IDs.
- `listAllDocuments` and `listAuditLog` require explicit `assertCan(actor, ...)` — defense-in-depth on the admin pages.
- Today timeline, daily report, by-animal report, and command-palette search all filter `animal.deletedAt`.
- `searchAnimalsAction` requires `q.length >= 2`; `searchActivitiesAction` clamps cache key length.

### Storage / Drive
- `MediaAsset.storageKey` now has a partial unique index (READY only). Combined with the explicit check in `finalizeUpload`, replay attacks where user B finalizes their own pending row with user A's `driveFileId` are blocked.
- Service-account scope tightened from full `drive` to `drive.file` everywhere.
- `getFileMetadata` failures no longer skip the parent + mime check (was a fail-open).
- `classifyMedia` rejects `image/svg+xml` outright. CSP + nosniff remain as defense-in-depth.
- `clear-drive-folder.ts` now requires `--confirm=<exact-root-id>` and refuses to run with `NODE_ENV=production` unless explicitly opted in. 5-second countdown before destructive action.
- Malformed service-account JSON yields a redacted error message — no key fragments in logs.
- Drive Files: list query now escapes both `\` and `'`.

### DB / Prisma
- `pnpm db:seed` refuses to run with `NODE_ENV=production` unless `ALLOW_PROD_SEED=yes`. Closes the "anyone can re-seed `admin@arham.care` with the public password" hole.
- New migration `prisma/migrations/20260522_prelaunch_hardening/migration.sql` adds:
  - Partial unique index on `MediaAsset.storageKey WHERE status='READY'`.
  - Partial indexes for the hot active-patient list and the activity feed.
  - Partial index for live documents.
- `binaryTargets` includes `rhel-openssl-3.0.x` for Vercel; `directUrl` added for non-pooled migrations.

### Vercel deploy
- `vercel.json` pins functions to `sin1` (same region as Neon ap-southeast-1, dropping ~250 ms RTT) and sets `maxDuration` per file route.
- `next.config.ts` adds HSTS, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy, X-Robots-Tag (noindex), and a strict CSP. `poweredByHeader: false`, `productionBrowserSourceMaps: false`.
- `noindex/nofollow` metadata on the root layout.
- Node engines pinned `>=20.0.0 <23.0.0`.
- `.env.example` regenerated to match every var the code actually reads.

### UI
- **UI-1** — the broken restore promise is fixed (string + Trash page).
- **UI-2** — Discharge + Death forms require a two-step confirm.
- **UI-14** — Discharged / deceased patients no longer show Log activity / Discharge / Death actions; menu collapses to Edit-only.
- **UI-9** — `weightKg` accepts `5,2` and normalises to `5.2`.
- **UI-4** — `Photo` falls back to the procedural SVG when the Drive image 404s.
- **UI-8** — Undo toast on delete lasts 12s.
- ARIA: AnimalDetailActions has `aria-haspopup`/`aria-expanded`/Escape close.

### Tests
- New `scripts/qa-trash-page.ts` — ADMIN can load `/admin/trash` and switch tabs.
- New `scripts/qa-trash-rbac.ts` — DOCTOR + STAFF are redirected from `/admin/trash`, `/admin/audit-log`, `/documents`.
- `scripts/e2e-today-timeline.ts` — race-condition fix: scope locators, wait for save toast.
- `scripts/e2e-daily-report.ts` — locator scoped to heading role.

## Vercel deploy checklist

When you push to Vercel, configure these Project Settings → Environment Variables (Production scope):

| Required | Notes |
|---|---|
| `AUTH_SECRET` | Generate fresh — **do NOT reuse the one in `.env.local`**. `openssl rand -base64 32` |
| `AUTH_URL` | `https://your-prod-domain.example` |
| `DATABASE_URL` | Neon pooled URL: `postgresql://...neon.tech/...?sslmode=require&pgbouncer=true&connection_limit=1` |
| `DIRECT_URL` | Neon direct (non-pooled) URL — for `prisma migrate deploy` |
| `STORAGE_DRIVER` | `gdrive` |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Base64-encoded SA JSON (new key — **rotate the one currently in `.env.local`**) |
| `GOOGLE_DRIVE_FOLDER_ID` | Root folder ID where the SA has Editor |
| `NEXT_PUBLIC_APP_URL` | Same as `AUTH_URL` |

### Pre-push secret rotation (do this BEFORE the first deploy)

1. **Neon**: rotate the DB password. Update `DATABASE_URL` in Vercel.
2. **Google Drive SA**: in IAM, generate a new key for the service account; revoke the old key. Update `GOOGLE_SERVICE_ACCOUNT_KEY` in Vercel.
3. **AUTH_SECRET**: generate a fresh one for prod with `openssl rand -base64 32`. Never reuse the dev one.
4. Confirm `.env.local` is in `.gitignore` (it is). The committed value in this repo is dev-only.

### Run on first deploy

```bash
# In Vercel build / runtime env:
pnpm exec prisma migrate deploy        # apply migrations (uses DIRECT_URL)

# Only if creating a brand-new prod DB and you want the admin seed:
ALLOW_PROD_SEED=yes pnpm exec dotenv -e .env.production.local -- tsx prisma/seed.ts
# (the seed otherwise refuses to run in production)
```

### Smoke-test order after deploy

1. Open `/login` — confirm form renders + can submit.
2. Sign in as `admin@arham.care`.
3. Confirm `/`, `/patients`, `/reports/today`, `/admin/trash` all render.
4. Log a new activity → confirm it shows on `/` timeline.
5. Delete it → confirm Undo toast → click Undo.
6. Sign out → confirm an audit row exists in `/admin/audit-log` for the login + logout.
7. Try `/admin/trash` from a STAFF account → confirm redirect to `/`.

## What was NOT fixed (deferred — see findings doc for full list)

These are tracked in `docs/superpowers/specs/2026-05-22-findings.md` but didn't make the launch cut. None block launch:

- **AUTH-9 / AUTH-10 / AUTH-11** — JWT idle vs absolute timeout distinction, stronger password policy, forced rotation on invite.
- **API-2 / API-5** — PENDING orphan cleanup cron, cache-control on `/api/files/[id]` for ACL changes mid-cache.
- **API-6** — Origin allowlist on `/api/files/initiate` (low impact, see findings).
- **SD-7 / SD-10 / SD-13** — Lifecycle activity-type rationalisation, full per-field audit on Animal edits, audit-log "drive_op" action vs flat 'update'.
- **STO-6 / STO-11 / STO-12** — p-retry Retry-After, finalize row-lock, orphan Drive file cleanup.
- **UI-3 / UI-7 / UI-11..17** — lightbox swipe, form-validation parity across all forms, focus-trap on ActivityQuickAdd + DocumentUploadDialog, command-palette ARIA, etc.
- **TST-7..12** — unit-test coverage gaps for users, animals, lifecycle, audit, quick-add reducer, RBAC negative paths.

The current set is enough for launch. After clinic use stabilises, work through the deferred list as a follow-up sweep.

## File map (everything new this session)

```
docs/superpowers/specs/
  2026-05-22-prelaunch-review-and-trash-design.md   approved spec
  2026-05-22-findings.md                            consolidated 170+ findings
  2026-05-22-prelaunch-summary.md                   this file

prisma/migrations/20260522_prelaunch_hardening/migration.sql

src/lib/
  auth.config.ts                                    new — edge-safe config
  env.ts                                            new — Zod env loader

src/features/trash/
  queries.ts
  actions.ts
  components/TrashTabs.tsx

src/app/(app)/admin/trash/page.tsx

vercel.json                                         new

scripts/
  qa-trash-page.ts                                  new
  qa-trash-rbac.ts                                  new
```

## Commit log this session

```
c99fa86 test: qa-trash-page + qa-trash-rbac probes; repair stale e2e probes
<latest> feat(security): pre-launch hardening pass + Trash feature
de8bb46 docs: consolidated pre-launch findings (28 Critical, 42 High)
9d6cb75 docs: pre-launch review + Trash feature design spec
```
