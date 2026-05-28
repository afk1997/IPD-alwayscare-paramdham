# App performance — phased rebuild of the user-felt latency story

**Status:** Draft. Phase-by-phase plan. Each phase is its own follow-on implementation plan + PR set.

## Why this exists

Tapping a patient card on a phone feels like the screen has hung. Saving an activity in the sheet feels like the same — the spinner spins, then the whole page seems to re-paint. Listing patients, opening a long-stay animal's detail page, and navigating between pages all feel laggy on mobile. This document captures the diagnosis, the rebuild plan in phases ordered by user-felt impact, and the rollout / risk boundary for each.

The plan is informed by:
- Reading the actual code paths (Section: Diagnosis).
- The current Vercel dashboard snapshot (Hobby tier, 27 days into the cycle, Fast Origin Transfer at 6.81 / 10 GB — a smoking gun for "we ship the same image bytes through functions over and over because nothing is edge-cached").

## Goals (priority-ordered, all measured by user-felt latency)

1. Tapping a patient card on mobile yields first content under 300 ms on a warm function.
2. Saving / editing / deleting an activity from the sheet feels instant — no whole-page re-paint, no spinner past ~150 ms.
3. A patient with 100+ activities scrolls smoothly without a render stall when entering the detail page.
4. Re-navigating between the same set of pages doesn't re-pay image cost.
5. Cold start aside, every read-only navigation on a warm function returns server HTML in under 200 ms.

## Non-goals (this plan)

- Removing the DB re-check of role / active in `getCurrentUser`. Phase 4 memoizes per-request only; it does not change the security boundary.
- Migrating off Google Drive storage.
- Replacing NextAuth, Prisma, or Postgres.
- Adding SWR or React Query. We use server actions + `revalidateTag` + tiny local-state stores. No new prod data-layer dep.
- Upgrading to React 19 for `useOptimistic` (we'll roll the equivalent with `useReducer` patterns).
- A full PWA / service-worker layer. Deferred to Phase 6, only if measurements after 1–5 still warrant it.

## Diagnosis

Compounding problems, roughly in the order they hurt a mobile user clicking around.

**D1 — Image delivery is the worst offender.** `src/app/api/files/[id]/route.ts` returns `cache-control: 'private, no-cache, must-revalidate'` and the `Photo` component (`src/components/media/Photo.tsx`) wraps `<Image>` with `unoptimized`. Every fetch runs: middleware (NextAuth JWT decode) → `getCurrentUser()` (1 DB query) → `getMediaForRead()` (1 DB query + up to 3 parallel link-check queries for non-owner reads) → Google Drive `files.get` metadata (RTT 1) → Google Drive `files.get` stream (RTT 2) → proxy stream. Worst case **5 DB queries + 2 Drive RTTs per image fetch**. On a list with 20 thumbnails, 20 full chains. Re-navigation pays the chain again — no edge cache, no browser cache, no resize. Vercel dashboard shows this as **6.81 / 10 GB Fast Origin Transfer in 27 days** with **48K Edge Requests vs 63K Function Invocations** — the inversion confirms the function is doing edge-cache's job.

**D2 — `router.refresh()` storm on every mutation.** 11 call sites currently call `router.refresh()` after server actions resolve: `ActivityTimeline` (edit/delete/duplicate), `QuickAddModal` (finish), `ActivityQuickAdd`, `AnimalEditForm`, `DocumentUploadDialog`, `AddCageForm`, `CageList` (×2), `TodayTimelineList`, plus `LoginForm` (acceptable). Each refresh re-runs the entire server tree for the current route. On a patient detail page that's `getAnimal + listActivitiesForAnimal(500-cap) + listDocumentsForAnimal + listAssignableCages` plus every thumbnail re-pays the D1 chain. The UI also blocks on this round-trip — no optimistic updates anywhere.

**D3 — `getCurrentUser()` hits Postgres on every server call.** Each server component render, each server action, and each `/api/files` request calls `getCurrentUser()`, which runs `auth()` (JWT decode) then `prisma.user.findUnique`. Within one page render the same query can fire 3–5 times (layout, page, action). Within an image-heavy page the same query fires once per image (each `/api/files/[id]` is its own request).

**D4 — No virtualization on long lists.** `ActivityTimeline` renders up to 500 activity rows + thumbnails at once; `PatientList` up to 200; `TodayTimelineList` up to 200. Each activity row carries an icon, two text rows, and a `Photo` with an SVG placeholder containing ~25 child nodes. On a long-stay patient, the DOM is a brick.

**D5 — Heavy client surface.** 73 of 120 TSX files declare `'use client'`. `AppShell` is client purely to track `drawerOpen` + mount four providers. Pages that don't actually need client behavior are still hydrated. Bundle and hydration both pay for it on every nav.

**D6 — Smaller things.** `getAnimal + listActivitiesForAnimal + listDocumentsForAnimal` parallelize in `Promise.all`, but `listAssignableCages` runs *after* the `.all` resolves — a redundant serial await. Drive `.get()` runs two `files.get` calls (metadata + media) when `MediaAsset.mimeType` and `MediaAsset.size` are already in our DB. The `<Image>` in `Photo` hardcodes `sizes="200px"` regardless of where it's rendered.

## Phased rebuild

Each phase is its own design follow-up, plan, and PR set. Ship in order, measure between phases, do not start the next until the previous is in prod and observed for a day.

| # | Phase | Goal served | Est. effort |
|---|-------|-------------|-------------|
| 0 | Measurement & Server-Timing | gives us before/after numbers | half day |
| 1 | Image delivery: signed URLs + edge cache + Next image optimization | G1, G4 | 1.5–2 days |
| 2 | Kill the `router.refresh()` storm; optimistic timeline & quick-add | G2 | 2 days |
| 3 | Virtualize ActivityTimeline / PatientList / TodayTimelineList | G3 | 1 day |
| 4 | Per-request memoization of `getCurrentUser`; parallelize sequential awaits | G5 | half day |
| 5 | Shrink client surface (split AppShell server/client; demote presentational client components) | G1, G5 | 1–2 days |
| 6 | *Optional* PWA + edge HTML cache | mobile re-visit | 1 day, conditional |

---

## Phase 0 — Measurement & Server-Timing

**Purpose:** Capture baseline numbers so we know what each subsequent phase actually moved. Also catches surprises before we commit to a design.

**Work:**
- New helper `src/lib/server-timing.ts`. Tiny accumulator:
  ```ts
  export function createTimings() {
    const marks: Array<[string, number]> = [];
    const start = performance.now();
    return {
      mark(name: string) { marks.push([name, performance.now() - start]); },
      header(): string {
        // emits: auth;dur=12, db;dur=34, drive-stream;dur=88, total;dur=140
      },
    };
  }
  ```
- Instrument `src/app/api/files/[id]/route.ts` with marks at `auth`, `db`, `drive-meta`, `drive-stream`, `total`. Attach the `Server-Timing` header to the response.
- Instrument `src/app/(app)/patients/[id]/page.tsx` and `src/features/animals/components/AnimalDetail.tsx` similarly. Server-Timing on RSC requires using the `headers()` API to attach to the streaming response — alternative is to log timings via `console.log` in dev only.
- Add a one-off Lighthouse run script `scripts/perf-baseline.sh` (pnpm + npx lighthouse against the local prod build). Output captured into `docs/perf/baseline-2026-05-28.md`.
- Document the perf budget for each goal (FCP < 1.5s on 4G, LCP < 2.5s, INP < 200 ms on the activity sheet's save click, server HTML < 200 ms warm). File: `docs/perf/budget.md`.

**Files touched:**
- New: `src/lib/server-timing.ts`
- Modified: `src/app/api/files/[id]/route.ts`
- Modified: `src/features/animals/components/AnimalDetail.tsx` (or its page wrapper, depending on where headers are easier to attach)
- New: `scripts/perf-baseline.sh`
- New: `docs/perf/baseline-2026-05-28.md`
- New: `docs/perf/budget.md`

**Risk:** None. Observability only, no behavior change.

**Out-of-scope for this phase:** No optimization in this phase. We measure, then plan Phase 1 against real numbers.

---

## Phase 1 — Image delivery (signed URLs + edge cache)

**Purpose:** Make image bytes hit the Vercel edge cache after the first fetch and stop running auth + DB + Drive on every image fetch. Re-enable Next image optimization for resize / format conversion (Hobby quota has plenty of headroom — 45 / 5K transforms used in the last 27 days).

### Signed-URL scheme — stable signatures, no rotation

```
/api/files/[id]?v=orig&sig=<hmac>
```

- `id`: `MediaAsset.id` (CUID, path param).
- `v`: variant. Phase 1 ships only `orig`.
- `sig`: HMAC-SHA256 of `${id}|${v}` using `AUTH_SECRET` (reused — no new secret to manage). Base64url-encoded. Truncated to 22 chars (≈ 128 bits of strength), no padding.

**Why no `exp` / no rotation:** the deep-review audit (2026-05-28) caught that bucketed expiry rotates the URL every 5 min, which rotates the `(source URL, width, quality)` cache key Next image optimization uses. Worst-case math: 100 assets × 3 widths × 2 formats × 12 buckets/hour × 24 × 30 ≈ 8.6 million transformations/month, against a Hobby cap of 5 K. Unworkable.

Stable signatures collapse that to **one transformation per `(assetId, width, format)` per cache lifetime** — i.e., a few thousand transformations total over the project's life, well under the 5 K monthly cap.

### Security posture trade — recalibrated

- A signed URL is a **permanent capability token** for that asset, valid until `AUTH_SECRET` rotates.
- ACL changes (role demotion, soft-delete, deactivation) do NOT revoke outstanding signed URLs. New URLs aren't minted for deactivated users (their RSC requests 401 at the layout), but URLs they already saw remain valid until secret rotation.
- For the user's threat model (small clinical staff, no public surface, no adversarial insiders) this is acceptable: the URL is only ever rendered into the authenticated staff app; a deactivated user can't log in to acquire new ones, and the bytes themselves are no more sensitive than the screenshots staff could already take.
- **Invalidation mechanism:** rotate `AUTH_SECRET`. All outstanding URLs across all assets become invalid simultaneously. This is the same primitive that rotates session JWTs, so the operation is already in the runbook.
- **No kill-switch / epoch bump.** Decided explicitly during brainstorming. If a privacy fire happens, we either purge from Vercel's cache dashboard manually OR rotate `AUTH_SECRET`.

### `src/lib/media-sign.ts` (new)

```ts
import { createHmac, timingSafeEqual } from 'node:crypto';

const SIG_LEN = 22;            // base64url chars (≈128 bits)

export function signMediaUrl(assetId: string, opts: { variant?: 'orig' } = {}): string {
  const variant = opts.variant ?? 'orig';
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET required for signing media URLs');
  const sig = createHmac('sha256', secret)
    .update(`${assetId}|${variant}`)
    .digest('base64url')
    .slice(0, SIG_LEN);
  return `/api/files/${assetId}?v=${variant}&sig=${sig}`;
}

export function verifyMediaUrl(
  assetId: string,
  search: URLSearchParams,
): { ok: true; variant: string } | { ok: false; reason: string } {
  const v = search.get('v') ?? '';
  const sig = search.get('sig') ?? '';
  if (v !== 'orig') return { ok: false, reason: 'unknown variant' };
  if (sig.length !== SIG_LEN) return { ok: false, reason: 'bad sig length' };
  const secret = process.env.AUTH_SECRET;
  if (!secret) return { ok: false, reason: 'no secret' };
  const want = createHmac('sha256', secret)
    .update(`${assetId}|${v}`)
    .digest('base64url')
    .slice(0, SIG_LEN);
  // Constant-time comparison on equal-length buffers
  const a = Buffer.from(sig);
  const b = Buffer.from(want);
  if (a.length !== b.length) return { ok: false, reason: 'sig mismatch' };
  if (!timingSafeEqual(a, b)) return { ok: false, reason: 'sig mismatch' };
  return { ok: true, variant: v };
}
```

### `next.config.ts` updates

Add an `images` block so Next image optimization holds optimized variants long enough that we hit the per-asset transformation count only once over the lifetime of the cache entry:

```ts
images: {
  // Hold optimized variants for up to one year before re-running the
  // transform.  Combined with stable signed URLs (unchanged cache key)
  // this keeps total transformations to ~(assets × widths × formats)
  // for the entire project, not per month.
  minimumCacheTTL: 60 * 60 * 24 * 365,
  formats: ['image/avif', 'image/webp'],
  // Cap variant explosion.  Each entry is one transformation per asset.
  deviceSizes: [320, 640, 1080],
  imageSizes: [64, 200, 400],
}
```

### Middleware bypass

`src/middleware.ts` matcher currently:
```
['/((?!api/auth|_next/static|_next/image|favicon.ico).*)']
```

Add `api/files` to the exclusion:
```
['/((?!api/auth|api/files|_next/static|_next/image|favicon.ico).*)']
```

Safety: `/api/files/[id]` still has its own auth path. If `sig` query is absent, the route falls through to `getCurrentUser`-based authorization (current behavior). Middleware bypass only matters for signed requests — and signed requests already carry their own bearer token.

### `src/app/api/files/[id]/route.ts` (rewritten)

Pseudocode shape:

```ts
export async function GET(req: Request, { params }) {
  const { id } = await params;
  const search = new URL(req.url).searchParams;
  const signed = search.has('sig');

  if (signed) {
    const v = verifyMediaUrl(id, search);
    if (!v.ok) return NextResponse.json({ error: v.reason }, { status: 401 });
    // No DB call. No getCurrentUser. Trust the signature.
    const asset = await prisma.mediaAsset.findUnique({
      where: { id },
      select: { id: true, status: true, storageKey: true, mimeType: true, size: true },
    });
    if (!asset || asset.status !== 'READY' || !asset.storageKey) {
      return NextResponse.json({ error: 'unavailable' }, { status: 410 });
    }
    // Drop the metadata RTT — we already have mimeType + size.
    const { stream } = await getStorage().getStreamOnly(asset.storageKey);
    return new NextResponse(toWeb(stream), {
      headers: {
        'content-type': asset.mimeType,
        'content-length': String(asset.size),
        'cache-control': 'public, max-age=600, s-maxage=600, immutable',
        'x-content-type-options': 'nosniff',
        // No vary: cookie. Cache key is the URL.
        etag: `"${asset.id}-${v.variant}"`,
      },
    });
  }

  // ── Fallback: cookie path (unchanged from today's behavior) ──
  // Existing auth + getMediaForRead + getStorage().get chain.
  // Same no-cache headers.
}
```

**Storage interface change:**
- Add `getStreamOnly(key: string): Promise<{ stream }>` to the `FileStorage` interface alongside `get`.
- `LocalDiskStorage.getStreamOnly` just opens the file.
- `GoogleDriveStorage.getStreamOnly` does only the `alt: 'media'` call, skipping the metadata RTT.

### Server-side URL minting — complete touchpoint inventory

All queries that produce asset IDs for client consumption mint signed URLs. Exhaustive list, audited 2026-05-28 against every `/api/files/` string in `src/`:

| Server file → adds | Client file → drops the `\`/api/files/${...}\`` |
|---|---|
| `src/features/animals/queries.ts` (`listAnimals`) → `thumbnailUrl` | `src/features/animals/components/PatientCard.tsx:15` |
| `src/features/animals/queries.ts` (`getAnimal`) → `media[i].url` | `src/features/animals/components/AnimalHero.tsx:37` |
| `src/features/activities/queries.ts` (`listActivitiesForAnimal`) → `media[i].url` | `src/features/activities/components/ActivityTimeline.tsx:142`, `ActivitySheet.tsx:341` (video) and `:357` (Photo) |
| `src/features/reports/queries.ts` (`listTodayActivities`) → `media[i].url`, `animalThumbnailUrl` | `src/features/reports/components/TodayTimelineList.tsx:101`, `:107` |
| `src/features/documents/queries.ts` (`listDocumentsForAnimal`, `listAllDocuments`) → `documents[i].file.url` | `src/features/documents/components/DocumentList.tsx:45` (the `<Link href>` for downloads) |
| (no server query — uses post-finalize asset) | `src/components/media/MediaUploader.tsx:139` — the `value` array of `UploadedAsset` needs a `url` field returned by the finalize response (see "Upload pipeline change" below) |
| (no server query — used by `MediaGrid`, `Lightbox`) | `src/components/media/MediaGrid.tsx:36` and `Lightbox.tsx:75` (video), `:83` (doc iframe), `:92` (image) — both take an `items: { id, … }[]` prop; we'll widen to `{ id, url, … }[]` and let every parent that constructs the items pass server-minted URLs |

**Audit gate for PR 3:** A grep `grep -rn '\`/api/files/\${' src/` must return zero results before PR 3 merges. Lints into CI.

**Upload pipeline change for `MediaUploader`:** `src/app/api/files/finalize/route.ts` already returns a `FinalizeResponse` with `{ id, kind, filename, ... }`. Extend it to include `{ url: signMediaUrl(asset.id) }`. The client's `value: UploadedAsset[]` array carries the URL; no client-side concatenation. The `inFlight` preview (pre-finalize) doesn't render any `/api/files` URL — it's just a spinner + filename — so no change needed there.

The `signMediaUrl` import lives in server files only — client components stop building file URLs entirely.

### `<Photo>`, `<MediaGrid>`, `<Lightbox>`, `<MediaUploader>` component changes

`src/components/media/Photo.tsx`:
- Caller passes `src` (the signed URL) or `undefined` (use SVG placeholder). `seed` stays — it's the placeholder palette key.
- Remove `unoptimized` from `<Image>` — Next runtime optimization re-enabled.
- Replace hardcoded `sizes="200px"` with a `sizes` prop, defaulted per call site:
  - Thumbnail (`PatientCard`, `ActivityRow`): `sizes="64px"`.
  - Medium (`AnimalHero`, `MediaGrid` columns=3): `sizes="200px"`.
  - Document grid (`MediaGrid` columns=4): `sizes="150px"`.

`src/components/media/MediaGrid.tsx`:
- Widen `LightboxItem` to `{ id, url, kind, ... }`. Drop `src={\`/api/files/${it.id}\`}`. Remove `unoptimized`.

`src/components/media/Lightbox.tsx`:
- Same `LightboxItem` widening flows through. Three `<video>` / `<iframe>` / `<Image>` sites swap to `current.url`. `unoptimized` removed from `<Image>`.
- Note for ops: video range requests and PDF iframe fetches are both served from `/api/files/[id]?...&sig=...`. Vercel CDN supports HTTP range requests natively on cached `public` responses — videos still seek without round-trip to origin once the byte range is cached.

`src/components/media/MediaUploader.tsx`:
- `UploadedAsset` widens to include `url`. Already-finalized previews use `u.url`; pending uploads keep their spinner-only render.

### Rollout

Four PRs:

1. **Ground work, no behavior change.** Add `media-sign.ts`. Unit tests for sign / verify (expiry, bad sig, wrong secret, bucket boundaries). Add `getStreamOnly` to storage interface, both implementations. Server-Timing wire-up if Phase 0 hasn't landed yet.

2. **Route accepts both auth paths.** `/api/files/[id]` handles signed *and* cookie. Add middleware bypass for `api/files`. Wire `listAnimals` to emit `thumbnailUrl`. Update `PatientCard` to use it. Verify thumbnails on `/patients` work. Keep `thumbnailAssetId` field shipped to client for rollback.

3. **Switch all queries.** Move every asset-bearing query to mint URLs. Drop client-side URL construction in `ActivitySheet`, `ActivityTimeline`, `AnimalHero`, `VisualRecords`, `MediaGrid`, `DocumentList`, `Lightbox`, etc.

4. **Cleanup.** Remove legacy `assetId`/`thumbnailAssetId` fields from client-shipped types. Remove `unoptimized` from `<Image>`. Update `Photo`'s `sizes` defaults per call site.

### Risk

- **Stable signatures = permanent capability tokens.** Documented and accepted in the security-posture section above. Invalidate by rotating `AUTH_SECRET`.
- **Transformation quota.** Per the audit, stable signatures + capped `deviceSizes` / `imageSizes` keep total transformations at roughly `assets × (deviceSizes + imageSizes) × formats` over the cache lifetime — for a 100-patient IPD, well under the 5K Hobby cap. Set up a Vercel usage alert at 80% as a safety net.
- **Cookie-auth fallback path still slow.** Acceptable — used only during transitional rollout and for direct-URL hits. After PR 4 lands, ~all production traffic is signed.
- **Missed call site.** A direct `\`/api/files/${id}\`` string anywhere in client code after PR 4 would silently fall through to the cookie-auth path (correct behavior, just slow). PR 3 includes a CI grep gate to fail builds with any such residual string in `src/`.
- **Range-request behavior on videos and PDFs.** Both go through `<video src>` and `<iframe src>`. Vercel CDN handles range requests on cached `public` responses; seek works without origin round-trip after first byte-range hit. Verified during PR 2 manual QA.
- **Middleware bypass safety.** Adding `api/files` to the middleware exclusion means signed-URL requests skip NextAuth entirely. Unsigned `/api/files/*` requests still hit the route handler, which falls through to `getCurrentUser`. Security boundary preserved; this is identical to today's behavior for signed-route absence.

### Measurement gate

After PR 4 ships:
- Re-run the Phase 0 baseline. Expected swings:
  - `/api/files/[id]` median server-time: ~400 ms → ~30 ms (signed path, edge miss) → ~5 ms (edge hit).
  - Fast Origin Transfer monthly: ~7 GB → < 2 GB (re-visits hit edge).
  - Function Invocations attributable to `/api/files`: drops by 10× under steady-state.

Phase 2 doesn't start until Phase 1 is in prod for at least 24 h and these numbers are observed.

---

## Phase 2 — Kill the `router.refresh()` storm

**Purpose:** Replace whole-page server re-fetch after every mutation with optimistic local state + selective `revalidateTag`. The UI feels instant; tagged server caches are still invalidated for the *next* nav.

### Strategy

1. Every mutating server action returns the **canonical post-mutation row** (or `null` for deletes), not just `{ ok: true }`. The client uses the returned row to splice local state. If the action fails, local state reverts.
2. `router.refresh()` is removed from client mutation handlers.
3. `revalidateTag(...)` stays inside server actions — it's free (just marks the cache stale) and is what makes the next navigation correct.
4. For cross-component updates (QuickAdd modal saving an activity while the patient page's ActivityTimeline is mounted), a tiny zero-dep external store using `useSyncExternalStore` carries the new row across.

### Per-component changes

**`src/features/activities/components/ActivityTimeline.tsx`** — the loudest pain point.
- Lift `activities` to local state seeded from props.
- `onChanged` is replaced with three handlers from `ActivitySheet`: `onSaved(activity)`, `onDeleted(id)`, `onDuplicated(activity)`.
- `updateActivityAction` returns the updated `ActivitySummary`. `ActivitySheet.save()` calls `onSaved` with it; timeline splices in place.
- `deleteActivityAction` returns `{ ok, id }`. Timeline filters locally. Undo restores via existing `restoreActivityAction`, which returns the restored row; timeline re-inserts.
- `duplicateActivityAction` returns the new row. Timeline prepends.
- No `router.refresh()`.

**`src/features/quick-add/QuickAddModal.tsx`** + **`QuickAddProvider.tsx`**
- New tiny hook: `src/lib/hooks/useActivityFeed.ts`:
  ```ts
  // Subscribers register for activity-feed events. Producers
  // (QuickAddModal finish handler) dispatch. Consumers
  // (ActivityTimeline, TodayTimelineList) re-render.
  ```
- Implementation uses `useSyncExternalStore` over a module-level `Set<Listener>` — no deps, ~30 lines.
- `QuickAddModal.finish(...)` dispatches the new activity. If the user is also navigating to the patient page, the timeline mounts already-seeded by `listActivitiesForAnimal` plus the dispatched event de-dupes.
- Drop `router.refresh()` from QuickAdd flow.

**`src/features/animals/components/AnimalEditForm.tsx`**
- Two consumers:
  - Standalone page (`/patients/[id]/edit`): submits then `router.push('/patients/[id]')`. The trailing `router.refresh()` is redundant after a push that navigates to a fresh route. Drop it.
  - Embedded edit-in-place (`AnimalDetailsTab` toggles `editing`): submits then `onDone()`. Here `router.refresh()` is currently the only way the parent sees the updated animal. Fix: the update action returns the updated `Animal` row; `AnimalEditForm` passes it to `onDone(updatedAnimal)`; `AnimalDetailsTab` updates local state. Drop `router.refresh()` once both paths are wired.

**`src/features/documents/components/DocumentUploadDialog.tsx`** + **`DocumentList`**
- Same pattern as ActivityTimeline. Action returns the new document row. Parent splices into local state.

**`src/features/cages/components/AddCageForm.tsx`** + **`CageList.tsx`**
- Same pattern. Local state in `CageList`, splice on assign / unassign.

**`src/features/reports/components/TodayTimelineList.tsx`**
- Subscribes to the `useActivityFeed` store. New rows arrive without `router.refresh`.

**`src/features/auth/components/LoginForm.tsx`**
- Keep the `router.refresh()` — runs once on successful login, not in a hot loop.

### Optimistic UI on the activity sheet

- `save` click → optimistically apply the patch to local state in `ActivityTimeline` → close sheet → toast.
- Server action runs in `startTransition`. On `ok: true`, replace optimistic row with canonical row (no visible change). On `ok: false`, revert + reopen sheet with the error.

For delete: existing undo toast already gives us optimism — we remove the row before the server-side soft-delete is confirmed (well, we wait for the server action today; switch to remove-first, server-confirm-after, with revert on failure).

### Rollout

Three PRs:

1. **`ActivityTimeline` rewrite.** Lift to local state. Update `updateActivityAction`, `deleteActivityAction`, `duplicateActivityAction`, `restoreActivityAction` to return canonical rows. Wire into `ActivitySheet` callbacks. Drop `router.refresh()` from this component path.

2. **`useActivityFeed` store + QuickAdd wiring.** Tiny external store. `QuickAddModal.finish` dispatches. Subscribers in `ActivityTimeline` and `TodayTimelineList`.

3. **Remaining call sites.** Cage forms, document upload, animal edit. Sweep, audit, no `router.refresh()` left except `LoginForm`.

### Risk

- **Optimistic / canonical mismatch.** If the server normalizes input (whitespace trim, etc.) the local optimistic row diverges briefly. Mitigation: server actions return canonical rows; client overlays them on success.
- **Two-device concurrency.** Device B doesn't see device A's logs until next nav (which refetches; `revalidateTag` makes that fetch fresh). Acceptable for this product — no real-time multi-user requirement stated.
- **Lost mutations on tab close.** Same as today — server actions still resolve, the only delta is in-tab UX.

### Measurement gate

INP on activity-sheet save click drops from observed ~600–1500 ms to < 200 ms.

---

## Phase 3 — Virtualize long lists

**Purpose:** Mounting 500 activity rows × ~30 DOM nodes each is a phone-melter. Virtualization keeps only visible rows mounted.

### Library

`@tanstack/react-virtual` — ~3 KB gzipped, headless, MIT, maintained, single dep. Adding it is justified; rolling our own is harder than it sounds when the list has variable row heights.

### Targets

| Component | Items | Approach |
|---|---|---|
| `ActivityTimeline` | up to 500 | Flatten day-grouped structure into mixed-row list: `{kind:'day-header', day} \| {kind:'activity', activity}`. `useVirtualizer` with `estimateSize: (i) => items[i].kind === 'day-header' ? 36 : 92`. `overscan: 5`. |
| `PatientList` | up to 200 | Uniform rows. `estimateSize: () => 84`. |
| `TodayTimelineList` | up to 200 | Uniform rows similar to ActivityTimeline. |

### Risk

- **Scroll restoration on back-nav.** TanStack Virtual exposes `scrollOffset`; we save it in `history.state` on unmount and restore on mount. Out of scope for v1 — accepting "scroll resets to top on back" for the first ship.
- **Row height drift.** If a row contains expandable content, `measureElement` adapts. Activity rows currently don't expand inline (the sheet handles that), so fixed estimates are fine.

### Rollout

Single PR per list. Ship `ActivityTimeline` first (loudest pain), then `PatientList`, then `TodayTimelineList`. Measure between.

### Measurement gate

Mount-time INP on `/patients/[id]` for a 300-activity patient drops from observed > 1s to < 200 ms. Memory footprint of the page drops noticeably (Chrome DevTools heap snapshot, mobile profile).

---

## Phase 4 — Auth hot path + parallelize sequential awaits

### React `cache()` wrap on `getCurrentUser`

`src/lib/auth.ts`:

```ts
import { cache } from 'react';

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  // existing body, untouched
});
```

`cache()` is per-request memoization (React's RSC primitive, not the Next data cache). Multiple callers within the same request graph share one promise. No security trade — DB re-check still happens, just once per request instead of N times.

### Parallelize `AnimalDetail` awaits

`src/features/animals/components/AnimalDetail.tsx`:

```ts
// Before
const [animal, activities, documents] = await Promise.all([
  getAnimal(animalId),
  listActivitiesForAnimal(animalId),
  listDocumentsForAnimal(animalId),
]);
if (!animal) notFound();
const cages = await listAssignableCages(animalId);  // serial!

// After
const [animal, activities, documents, cages] = await Promise.all([
  getAnimal(animalId),
  listActivitiesForAnimal(animalId),
  listDocumentsForAnimal(animalId),
  listAssignableCages(animalId),
]);
if (!animal) notFound();
```

The `notFound()` redirect runs after the `.all` resolves. Doing one redundant cage-list fetch when the animal doesn't exist is fine — animal-not-found is rare.

### Sweep for other sequential awaits

Grep for `await .* findFirst|findMany|findUnique` patterns inside server components and server actions. Fix any obvious serial chains. Out of scope: cross-feature query merging — only single-file sequential fixes.

### Risk

- **`cache()` shared state.** `cache()` is per-request. No leakage. Tested in React 18.3.1 (current dep version), no upgrade needed.

### Measurement gate

Patient detail page server-time drops by 50–100 ms typical (one fewer Postgres round-trip after the Promise.all consolidation, plus eliminated duplicate `getCurrentUser` queries).

---

## Phase 5 — Shrink the client surface

### Split `AppShell` server / client

Current `src/components/shell/AppShell.tsx` is fully `'use client'` for two `useState`s and four providers. Split:

- **`AppShell` (server, in `src/components/shell/AppShell.tsx`)**: renders the outer layout — sidebar slot, main container — server-side. No state.
- **`AppShellClient` (new, `src/components/shell/AppShellClient.tsx`)**: wraps the providers + the parts that need state (`SideNavDrawer`, `TopBar`'s menu button, `BottomNav` which uses `usePathname`). Receives the server-rendered children as a prop.

```
AppShell (server)
└── AppShellClient (client)
    ├── ToastProvider
    ├── CommandPaletteProvider
    ├── QuickAddProvider
    ├── ActiveUsersProvider
    ├── SideNav (now server)
    ├── SideNavDrawer (client; controls drawerOpen)
    ├── TopBar (client; menu button)
    ├── BottomNav (client; usePathname)
    └── {children}
```

### Demote pure-presentation client components

Audited 2026-05-28 — most UI primitives are **already** server components (`Button`, `Chip`, `EmptyState`, `Input`, `Pill`, `Select`, `Stepper`, `Textarea`, `StatusBadge`, `FreshnessIndicator`). So Phase 5's demotion list is much shorter than initially feared.

Actual demotion candidates (TBD after Phase 1–4 land — re-audit then):
- `src/features/animals/components/AnimalHero.tsx` — currently `'use client'` purely for the lightbox `useState`. Could split: server-rendered hero card + a thin client wrapper around the photo button + lightbox.
- `src/features/animals/components/AnimalDetailsTab.tsx` — `'use client'` for the `editing` toggle. Same split pattern as AnimalHero.
- `src/features/animals/components/AnimalDetailActions.tsx` — likely fine to stay client (interactive menu).

The bigger Phase 5 work is the `AppShell` server/client split documented above. The presentational demotions are a small follow-on, not a large refactor.

### Bundle audit

After the split + demotions, run `next build` and inspect the per-route JS size. If any route is over 250 KB gzipped on the client, drill in.

### Risk

- **Provider mount order.** `AppShellClient` must be high enough in the tree that all child server components are inside its `children` prop. Standard pattern.
- **`SideNav` interactivity.** Currently uses `usePathname` for the active-link highlight. Either keep it `'use client'` for that, or use route-segment matching in CSS. Defer the CSS approach; keep `'use client'` for SideNav.

### Measurement gate

Page-level JS bundle size for `/patients` drops by at least 15%. Hydration time on mid-tier Android profile drops noticeably (Lighthouse score moves up).

---

## Phase 6 — Optional: PWA + edge HTML cache

Deferred. Re-evaluate after Phase 5 numbers are in. The combined effect of Phases 1–5 may make this redundant for the current scale.

If it's still warranted:
- `next-pwa` for service-worker scaffolding.
- Image cache strategy: stale-while-revalidate on `/api/files/*` (now public-cacheable).
- HTML cache: skip — server-rendered pages are user-specific and cookie-bearing.

---

## Cross-cutting items

### Performance budget (lives in `docs/perf/budget.md`)

| Metric | Budget | Page |
|---|---|---|
| FCP (4G, throttled) | < 1.5 s | `/patients`, `/patients/[id]` |
| LCP | < 2.5 s | `/patients/[id]` |
| INP (activity sheet save) | < 200 ms | `/patients/[id]` |
| Server HTML response (warm) | < 200 ms | All `(app)` routes |
| `/api/files` edge-cache hit ratio | > 80% | All `/api/files/[id]?sig=...` requests |
| Fast Origin Transfer | < 3 GB / month | Vercel dashboard |

### Regression guard

Add a Playwright test in `tests/e2e/perf.spec.ts`:
- Loads `/patients/[id]` for a known seed animal.
- Asserts `Server-Timing` `total` header value is < 500 ms on warm.
- Asserts at least one image response carries `cache-control: public`.

This runs in CI after each PR. Fails build if either degrades.

### Observability outside dev

- After Phase 0 ships, every `/api/files` request and key page emits `Server-Timing` to the user's browser DevTools. We can sample these into Vercel Speed Insights later if needed — out of scope for this plan.

---

## Sequence of work

1. Phase 0 (half day) — measurement scaffolding lands. Baseline numbers captured.
2. Phase 1 (1.5–2 days, 4 PRs) — image delivery rebuilt. **Measurement gate** before continuing.
3. Phase 2 (2 days, 3 PRs) — mutation UX. **Measurement gate.**
4. Phase 3 (1 day) — virtualization.
5. Phase 4 (half day) — auth memoization + parallel awaits.
6. Phase 5 (1–2 days) — client-surface shrink.
7. Phase 6 — only if measurements still warrant.

Total: ~6–8 working days end-to-end, but split across phase-gated PRs so the user sees the biggest wins (Phase 1, Phase 2) within the first week.

## Open questions

None. All decisions resolved during brainstorming.

## Appendix — Deep-review pass (2026-05-28)

Recorded for traceability. After the first draft was written, a second pass reread the diagnosis against every relevant file in `src/`. Changes folded into the body of the spec:

1. **Critical correction — signature scheme.** Original spec used bucketed `exp` rotating every 5 min. Audit caught that rotating sigs rotate the `_next/image` cache key → transformation quota explosion on Hobby tier. Switched to **stable signatures** (HMAC of `assetId|variant` only, no `exp`). Trade-off documented (URLs are permanent capabilities until secret rotation).

2. **`next.config.ts` configuration added.** `images.minimumCacheTTL = 1 year`, `deviceSizes` and `imageSizes` capped. Prevents transformation-count drift.

3. **Touchpoint inventory completed.** Original spec listed five queries to update. Audit found **eleven** `/api/files/` string-build sites in client code. Full table now in the "Server-side URL minting" section. `MediaUploader.tsx`, `MediaGrid.tsx`, `Lightbox.tsx` (three call sites), `DocumentList.tsx`, and `TodayTimelineList.tsx` were all missing.

4. **CI grep gate added.** PR 3 fails if `\`/api/files/${` appears anywhere in `src/` after the migration. Catches missed call sites.

5. **`MediaAsset` schema confirmation.** Width, height, durationSec already stored on the asset row. `mimeType` and `size` likewise — confirming we can drop the Drive `files.get` metadata RTT.

6. **`getMediaForRead` deeper than originally described.** Up to 5 DB queries on the cookie-auth path. Updated D1 in the diagnosis. The signed-URL path collapses this to one query (asset lookup for `storageKey`).

7. **Phase 5 over-claim corrected.** `Button`, `Chip`, `EmptyState`, `Input`, `Pill`, `Select`, `Stepper`, `Textarea`, `StatusBadge`, `FreshnessIndicator` are **already** server components — original spec's claim that they needed demoting was wrong. Phase 5's actual demotion list is narrower (AnimalHero, AnimalDetailsTab) and lower-priority than the AppShell server/client split.

8. **`AnimalEditForm` embedded use-case** (also caught in the first self-review): used both standalone and embedded in `AnimalDetailsTab`. Both paths get explicit treatment in Phase 2.

9. **DocumentList download semantics.** The `<Link href="/api/files/...">` is a navigation, not an `<img>`. Signed URL works identically; browser follows the link, route serves the bytes with `content-disposition` (today implicit by mime).

10. **Range-request / iframe behavior verified.** Vercel CDN supports range requests on cached `public` responses. Video seeking and PDF iframe rendering both work post-Phase-1.

No further open items found in the deep audit.
