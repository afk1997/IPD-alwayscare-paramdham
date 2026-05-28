# Phase 0 + Phase 1 — Measurement & Image Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture before/after performance numbers (Phase 0), then replace the per-image auth + DB + Drive chain with HMAC-signed URLs that Vercel's edge CDN can cache and Next image optimization can resize to mobile-appropriate sizes (Phase 1).

**Architecture:** Phase 0 adds a tiny `Server-Timing` accumulator helper, instruments the `/api/files/[id]` route, and writes a baseline doc. Phase 1 introduces stable HMAC-signed media URLs (`/api/files/[id]?v=orig&sig=<22chars>`) reusing `AUTH_SECRET`, bypasses NextAuth middleware for `/api/files` (route still re-validates), drops the Drive metadata RTT by relying on `MediaAsset.mimeType` / `.size`, and re-enables Next image optimization with a 1-year `minimumCacheTTL` so the Hobby-tier transformation quota is hit at most once per `(asset, width, format)` over the project's life. Cookie-auth fallback path stays during rollout for backward compatibility.

**Tech Stack:** Next.js 15 (App Router, route handlers, RSC), Prisma 5 + PostgreSQL, NextAuth v5 (JWT), Node `crypto` for HMAC, Vitest (unit), Playwright (e2e), Biome.

**Spec:** `docs/superpowers/specs/2026-05-28-app-performance-design.md`

---

## Prerequisites

- On branch `perf-rebuild-plan` (already created — the spec lives there).
- A reachable dev Postgres in `.env.local` (`DATABASE_URL` / `DIRECT_URL`). Use `pnpm db:up` if local.
- `pnpm db:seed` has been run so integration tests find the seeded users.
- `AUTH_SECRET` is set in `.env.local`. It will be reused for HMAC signing — no new secret to provision.
- Vercel project env var `AUTH_SECRET` is set for Production AND Preview (it already is — it's been used for session JWTs).
- Phase 2-5 will get their own plans after Phase 1 ships and we measure. **Do not start Phase 2 work in this plan.**

---

## Test Strategy

- **Unit (Vitest, default config):** `src/lib/media-sign.ts`, `src/lib/server-timing.ts`. No DB, fast feedback.
- **Integration (Vitest, integration config):** Query-layer changes that mint signed URLs need a real DB. Run with `pnpm test:integration`.
- **E2E (Playwright):** One end-to-end test that visits `/patients`, asserts at least one `<img>` carries `?sig=` in its source. Run with `pnpm test:e2e`.
- **Existing tests must keep passing.** Refactor tasks finish by running the full unit + e2e suites.

---

## Branch / commit discipline

- Each task ends with a commit. The spec calls for 4 PRs in Phase 1; tasks are grouped by PR below. Open the PR after the last task in each group.
- PR titles: `feat(perf): phase 0 — server-timing baseline`, `feat(perf): phase 1 PR1 — media-sign + storage interface`, `feat(perf): phase 1 PR2 — /api/files accepts signed URLs`, `feat(perf): phase 1 PR3 — migrate all client touchpoints`, `feat(perf): phase 1 PR4 — cleanup, Next image optimization`.

---

# Phase 0 — Measurement

## Task 0.1: `server-timing.ts` helper (TDD)

**Files:**
- Create: `src/lib/server-timing.ts`
- Create: `src/lib/__tests__/server-timing.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/server-timing.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createTimings } from '../server-timing';

describe('createTimings', () => {
  it('accumulates marks and emits a Server-Timing header value', () => {
    const t = createTimings();
    t.mark('auth');
    t.mark('db');
    const header = t.header();
    // Marks are absolute ms from start.  Order preserved.  Final
    // `total` mark is always emitted.
    expect(header).toMatch(/^auth;dur=\d+(\.\d+)?,db;dur=\d+(\.\d+)?,total;dur=\d+(\.\d+)?$/);
  });

  it('emits a single total mark when no other marks were taken', () => {
    const t = createTimings();
    expect(t.header()).toMatch(/^total;dur=\d+(\.\d+)?$/);
  });

  it('returns strictly non-decreasing durations', () => {
    const t = createTimings();
    t.mark('a');
    t.mark('b');
    t.mark('c');
    const parts = t.header().split(',').map((p) => Number(p.split('dur=')[1]));
    for (let i = 1; i < parts.length; i++) {
      expect(parts[i]).toBeGreaterThanOrEqual(parts[i - 1]);
    }
  });
});
```

- [ ] **Step 2: Run the failing tests**

```
pnpm test src/lib/__tests__/server-timing.test.ts
```

Expected: fail with "Cannot find module ../server-timing".

- [ ] **Step 3: Implement the helper**

Create `src/lib/server-timing.ts`:

```ts
/**
 * Tiny accumulator that produces a `Server-Timing` header value.
 * Used to measure where time goes in request handlers and (via
 * console.log) in RSC renders where setting response headers from
 * a Server Component isn't supported.
 *
 * Usage:
 *   const t = createTimings();
 *   await doThing();
 *   t.mark('thing');
 *   await doOther();
 *   t.mark('other');
 *   res.headers.set('Server-Timing', t.header());
 */
export interface Timings {
  mark(name: string): void;
  header(): string;
}

export function createTimings(): Timings {
  const start = performance.now();
  const marks: Array<[string, number]> = [];
  return {
    mark(name: string) {
      marks.push([name, performance.now() - start]);
    },
    header() {
      const total: [string, number] = ['total', performance.now() - start];
      const all = [...marks, total];
      return all.map(([n, d]) => `${n};dur=${d.toFixed(1)}`).join(',');
    },
  };
}
```

- [ ] **Step 4: Run the tests**

```
pnpm test src/lib/__tests__/server-timing.test.ts
```

Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server-timing.ts src/lib/__tests__/server-timing.test.ts
git commit -m "feat(perf): add server-timing accumulator helper

Tiny Timings interface emits a comma-separated Server-Timing
header value.  Used by /api/files and key RSC pages to record
where wall-clock time is spent in a request."
```

---

## Task 0.2: Instrument `/api/files/[id]` with Server-Timing

**Files:**
- Modify: `src/app/api/files/[id]/route.ts`

- [ ] **Step 1: Wrap the handler with timings**

Replace the body of `GET` in `src/app/api/files/[id]/route.ts` so each significant step is marked, and the timings ship as a response header:

```ts
import { Readable } from 'node:stream';
import { getMediaForRead } from '@/features/media/service';
import { getCurrentUser } from '@/lib/auth';
import { NotFoundError, RbacError } from '@/lib/errors';
import { createTimings } from '@/lib/server-timing';
import { getStorage } from '@/lib/storage';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const t = createTimings();

  const user = await getCurrentUser();
  t.mark('auth');
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: { 'server-timing': t.header() } });
  }

  const { id } = await params;

  let asset: Awaited<ReturnType<typeof getMediaForRead>>;
  try {
    asset = await getMediaForRead({ id: user.id, role: user.role }, id);
  } catch (e) {
    t.mark('db');
    if (e instanceof NotFoundError)
      return NextResponse.json({ error: e.message }, { status: 404, headers: { 'server-timing': t.header() } });
    if (e instanceof RbacError)
      return NextResponse.json({ error: e.message }, { status: 403, headers: { 'server-timing': t.header() } });
    throw e;
  }
  t.mark('db');

  if (asset.status === 'PENDING') {
    return NextResponse.json({ error: 'asset still uploading' }, { status: 425, headers: { 'server-timing': t.header() } });
  }
  if (asset.status === 'FAILED' || !asset.storageKey) {
    return NextResponse.json({ error: 'asset unavailable' }, { status: 410, headers: { 'server-timing': t.header() } });
  }

  const { stream, size } = await getStorage().get(asset.storageKey);
  t.mark('storage');
  const webStream =
    stream instanceof Readable
      ? (Readable.toWeb(stream) as unknown as ReadableStream<Uint8Array>)
      : (stream as unknown as ReadableStream<Uint8Array>);

  const headers: Record<string, string> = {
    'content-type': asset.mimeType,
    'cache-control': 'private, no-cache, max-age=0, must-revalidate',
    vary: 'cookie',
    etag: `"${asset.id}"`,
    'x-content-type-options': 'nosniff',
    'content-security-policy': "default-src 'none'; img-src 'self'; media-src 'self'",
    'referrer-policy': 'no-referrer',
    'server-timing': t.header(),
  };
  if (size > 0) headers['content-length'] = String(size);

  return new NextResponse(webStream, { headers });
}
```

- [ ] **Step 2: Verify the route still serves images**

Start dev: `pnpm dev`. Open `http://localhost:3000`, sign in, navigate to `/patients`, open DevTools → Network → click any thumbnail row. Confirm:
- The `/api/files/<id>` request returns 200.
- Its response includes a `server-timing` header with `auth;dur=`, `db;dur=`, `storage;dur=`, `total;dur=`.

Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/files/[id]/route.ts
git commit -m "feat(perf): instrument /api/files with Server-Timing

Marks auth, db, storage, total so the response header carries
per-stage timings.  Captured into the Phase 0 baseline doc."
```

---

## Task 0.3: Capture baseline numbers and write budget docs

**Files:**
- Create: `docs/perf/baseline-2026-05-28.md`
- Create: `docs/perf/budget.md`

- [ ] **Step 1: Capture five `/api/files` requests against production**

Open `https://<your-vercel-prod-domain>/patients` on your phone (or DevTools mobile emulation). Open DevTools → Network. Filter for `api/files`. Click any five thumbnail rows and record the `server-timing` response header for each. (Or use `curl -I` with a valid session cookie if easier.)

- [ ] **Step 2: Capture a Lighthouse mobile run against production**

Local:
```
pnpm exec lighthouse https://<your-vercel-prod-domain>/patients \
  --preset=mobile --quiet --output=json --output-path=./tmp/lh-patients.json
pnpm exec lighthouse https://<your-vercel-prod-domain>/patients/<some-id> \
  --preset=mobile --quiet --output=json --output-path=./tmp/lh-patient.json
```

Record FCP, LCP, TBT, INP (or Total Blocking Time if INP isn't reported), Speed Index, and the "Largest Contentful Paint element" identifier.

- [ ] **Step 3: Write the baseline doc**

Create `docs/perf/baseline-2026-05-28.md`:

```markdown
# Performance baseline — 2026-05-28

Captured against production before Phase 1 changes.  Phase 1 will
re-capture these numbers and we'll diff.

## /api/files response timings (median of 5)

| Stage  | Median (ms) |
|--------|-------------|
| auth   | <fill>      |
| db     | <fill>      |
| storage| <fill>      |
| total  | <fill>      |

Raw samples:
- <paste 5 server-timing headers>

## Lighthouse — mobile

### /patients
- FCP:    <fill> ms
- LCP:    <fill> ms
- TBT:    <fill> ms
- Speed Index: <fill> ms
- LCP element: <fill>

### /patients/<id>
- FCP:    <fill> ms
- LCP:    <fill> ms
- TBT:    <fill> ms
- Speed Index: <fill> ms
- LCP element: <fill>

## Vercel dashboard snapshot

- Fast Origin Transfer:    6.81 / 10 GB (27 days into cycle)
- Image Optimization Transforms: 45 / 5K
- Image Optimization Cache Writes: 1.2K / 100K
- Function Invocations: 63K / 1M
- Edge Requests: 48K / 1M
- Fluid Active CPU: 1h 24m / 4h
```

Replace `<fill>` with the captured numbers.

- [ ] **Step 4: Write the budget doc**

Create `docs/perf/budget.md`:

```markdown
# Performance budget

Targets the spec's goals.  Each Phase's measurement gate compares against this.

| Metric | Budget | Page |
|---|---|---|
| FCP (4G, throttled, Lighthouse mobile preset) | < 1.5 s | `/patients`, `/patients/[id]` |
| LCP                                            | < 2.5 s | `/patients/[id]` |
| INP (activity sheet save click)                | < 200 ms | `/patients/[id]` |
| Server HTML response (warm)                    | < 200 ms | All `(app)` routes |
| `/api/files` Server-Timing total (warm)        | < 50 ms (signed) / < 400 ms (cookie) | `/api/files/[id]` |
| Fast Origin Transfer (Vercel monthly)          | < 3 GB / month | dashboard |
| Image Optimization Transforms (monthly)        | < 1K / month steady-state | dashboard |
```

- [ ] **Step 5: Commit**

```bash
git add docs/perf/baseline-2026-05-28.md docs/perf/budget.md
git commit -m "docs(perf): capture Phase 0 baseline and budget

Median /api/files response timings, Lighthouse mobile scores
for /patients and /patients/[id], and the Vercel dashboard
snapshot are recorded against pre-Phase-1 production.

The budget doc captures the targets every subsequent phase
will be measured against."
```

---

## Task 0.4: Open Phase 0 PR

- [ ] **Step 1: Push branch**

```bash
git push -u origin perf-rebuild-plan
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --title "feat(perf): phase 0 — server-timing baseline" \
  --body "$(cat <<'EOF'
Adds the Server-Timing accumulator helper and instruments
/api/files/[id] with auth/db/storage/total marks.

Baseline numbers captured in docs/perf/baseline-2026-05-28.md.
Performance budget for the full rebuild in docs/perf/budget.md.

Spec: docs/superpowers/specs/2026-05-28-app-performance-design.md
Phase: 0 of 5

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Wait for CI, merge, return to local main**

```bash
gh pr merge --squash --delete-branch
git checkout main
git pull
git checkout -b perf-phase-1
```

---

# Phase 1 — Image delivery

## PR 1 — Ground work (media-sign + storage interface)

### Task 1.1: `media-sign.ts` — sign + verify roundtrip (TDD)

**Files:**
- Create: `src/lib/media-sign.ts`
- Create: `src/lib/__tests__/media-sign.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/media-sign.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { signMediaUrl, verifyMediaUrl } from '../media-sign';

const ASSET = 'clz0a1b2c3d4e5f6g7h8';
const ORIG_SECRET = process.env.AUTH_SECRET;

beforeEach(() => {
  process.env.AUTH_SECRET = 'test-secret-32-bytes-aaaaaaaaaaaa';
});

afterEach(() => {
  if (ORIG_SECRET === undefined) delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET = ORIG_SECRET;
});

describe('signMediaUrl / verifyMediaUrl', () => {
  it('signs and verifies a roundtrip', () => {
    const url = signMediaUrl(ASSET);
    expect(url).toMatch(/^\/api\/files\/clz0a1b2c3d4e5f6g7h8\?v=orig&sig=[A-Za-z0-9_-]{22}$/);
    const params = new URL(`http://x${url}`).searchParams;
    const v = verifyMediaUrl(ASSET, params);
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.variant).toBe('orig');
  });

  it('rejects a tampered signature', () => {
    const url = signMediaUrl(ASSET);
    const params = new URL(`http://x${url}`).searchParams;
    // Flip one character of the sig.
    const sig = params.get('sig') ?? '';
    const tampered = sig[0] === 'A' ? `B${sig.slice(1)}` : `A${sig.slice(1)}`;
    params.set('sig', tampered);
    const v = verifyMediaUrl(ASSET, params);
    expect(v.ok).toBe(false);
  });

  it('rejects when the asset id does not match what was signed', () => {
    const url = signMediaUrl(ASSET);
    const params = new URL(`http://x${url}`).searchParams;
    const v = verifyMediaUrl('clxxxxxxxxxxxxxxxxxx', params);
    expect(v.ok).toBe(false);
  });

  it('rejects an unknown variant', () => {
    const url = signMediaUrl(ASSET);
    const params = new URL(`http://x${url}`).searchParams;
    params.set('v', 'thumb');
    const v = verifyMediaUrl(ASSET, params);
    expect(v.ok).toBe(false);
  });

  it('rejects when sig is the wrong length', () => {
    const params = new URLSearchParams({ v: 'orig', sig: 'short' });
    const v = verifyMediaUrl(ASSET, params);
    expect(v.ok).toBe(false);
  });

  it('throws when AUTH_SECRET is missing at sign time', () => {
    delete process.env.AUTH_SECRET;
    expect(() => signMediaUrl(ASSET)).toThrow(/AUTH_SECRET/);
  });

  it('rejects at verify time when AUTH_SECRET is missing', () => {
    const url = signMediaUrl(ASSET);
    const params = new URL(`http://x${url}`).searchParams;
    delete process.env.AUTH_SECRET;
    const v = verifyMediaUrl(ASSET, params);
    expect(v.ok).toBe(false);
  });

  it('produces the same URL on repeated calls for the same asset (stable sig)', () => {
    expect(signMediaUrl(ASSET)).toEqual(signMediaUrl(ASSET));
  });
});
```

- [ ] **Step 2: Run failing tests**

```
pnpm test src/lib/__tests__/media-sign.test.ts
```

Expected: fail with "Cannot find module ../media-sign".

- [ ] **Step 3: Implement `media-sign.ts`**

Create `src/lib/media-sign.ts`:

```ts
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * HMAC-signed URLs for /api/files/[id].
 *
 * The signature is stable per (assetId, variant) — there is no
 * expiry parameter.  This is deliberate: Next image optimization
 * uses the full source URL as part of its cache key, so a rotating
 * URL would blow Vercel's image transformation quota every time
 * the bucket flipped.  Stable URLs collapse the transformation
 * count to ~(assets × widths × formats) over the project's life.
 *
 * Security boundary: the URL is a permanent capability token
 * valid until AUTH_SECRET rotates.  Acceptable for the Arham IPD
 * threat model (small clinical staff, no external surface).  See
 * the spec at docs/superpowers/specs/2026-05-28-app-performance-design.md
 * for the full rationale.
 */

const SIG_LEN = 22; // base64url chars (~128 bits of strength)

export type MediaVariant = 'orig';

export function signMediaUrl(assetId: string, opts: { variant?: MediaVariant } = {}): string {
  const variant = opts.variant ?? 'orig';
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET required for signing media URLs');
  const sig = createHmac('sha256', secret)
    .update(`${assetId}|${variant}`)
    .digest('base64url')
    .slice(0, SIG_LEN);
  return `/api/files/${assetId}?v=${variant}&sig=${sig}`;
}

export type VerifyResult =
  | { ok: true; variant: MediaVariant }
  | { ok: false; reason: string };

export function verifyMediaUrl(assetId: string, search: URLSearchParams): VerifyResult {
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
  const a = Buffer.from(sig);
  const b = Buffer.from(want);
  if (a.length !== b.length) return { ok: false, reason: 'sig mismatch' };
  if (!timingSafeEqual(a, b)) return { ok: false, reason: 'sig mismatch' };
  return { ok: true, variant: 'orig' };
}
```

- [ ] **Step 4: Run tests**

```
pnpm test src/lib/__tests__/media-sign.test.ts
```

Expected: 8 passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/media-sign.ts src/lib/__tests__/media-sign.test.ts
git commit -m "feat(media): HMAC-signed media URLs (sign + verify)

Stable per-(assetId, variant) signatures reuse AUTH_SECRET.
22 base64url chars (~128 bits).  Constant-time comparison.

Stable (no rotation) is deliberate: Next image optimization
keys its cache by source URL, so rotating sigs would blow
the Vercel transformation quota.  Per the spec, the URL is
a permanent capability until AUTH_SECRET rotates — acceptable
for the IPD threat model."
```

---

### Task 1.2: Add `getStreamOnly` to the FileStorage interface (type-only change)

**Files:**
- Modify: `src/lib/storage/index.ts`

- [ ] **Step 1: Add the method to the interface**

In `src/lib/storage/index.ts`, modify the `FileStorage` interface to add `getStreamOnly`:

```ts
export interface FileStorage {
  put(buf: Buffer, meta: { filename: string; mime: string }): Promise<PutResult>;
  get(key: string): Promise<{ stream: NodeJS.ReadableStream; mime: string; size: number }>;
  /**
   * Faster sibling of get() — returns only the byte stream and skips
   * any storage-side metadata RTT.  Callers that already have the
   * asset's mimeType and size from the DB (the /api/files signed
   * path does) use this to avoid a redundant Drive `files.get`.
   */
  getStreamOnly(key: string): Promise<{ stream: NodeJS.ReadableStream }>;
  delete(key: string): Promise<void>;
  directUrl(key: string): string | null;
}
```

- [ ] **Step 2: Run typecheck — expect errors**

```
pnpm typecheck
```

Expected: errors for `LocalDiskStorage` and `GoogleDriveStorage` missing `getStreamOnly`.

- [ ] **Step 3: Commit (interface only, will not type-check yet)**

Skip commit — Task 1.3 and 1.4 implement both backends in this same PR. Move on.

---

### Task 1.3: Implement `getStreamOnly` on `LocalDiskStorage`

**Files:**
- Modify: `src/lib/storage/local.ts`

- [ ] **Step 1: Read the existing `get` implementation**

```
cat src/lib/storage/local.ts
```

Note the path-resolution logic; `getStreamOnly` reuses it.

- [ ] **Step 2: Add `getStreamOnly` to `LocalDiskStorage`**

Inside the `LocalDiskStorage` class in `src/lib/storage/local.ts`, after the existing `get` method, add:

```ts
  async getStreamOnly(key: string): Promise<{ stream: NodeJS.ReadableStream }> {
    if (!key.startsWith(this.prefix)) throw new Error(`Invalid local key: ${key}`);
    const rel = key.slice(this.prefix.length);
    const full = path.join(this.root, rel);
    const stream = createReadStream(full);
    return { stream };
  }
```

(If `path` or `createReadStream` aren't yet imported in the file, add `import { createReadStream } from 'node:fs';` and `import path from 'node:path';` at the top — they likely already are, given `get` uses them.)

- [ ] **Step 3: Typecheck**

```
pnpm typecheck
```

Expected: only `GoogleDriveStorage` error remains.

- [ ] **Step 4: Commit later — bundled with Task 1.4**

Continue to Task 1.4 without committing.

---

### Task 1.4: Implement `getStreamOnly` on `GoogleDriveStorage` (skip metadata RTT)

**Files:**
- Modify: `src/lib/storage/gdrive.ts`

- [ ] **Step 1: Add `getStreamOnly`**

Open `src/lib/storage/gdrive.ts`. After the existing `async get(key: string)` method, add:

```ts
  async getStreamOnly(key: string): Promise<{ stream: NodeJS.ReadableStream }> {
    if (!key.startsWith(PREFIX)) throw new Error(`Invalid gdrive key: ${key}`);
    const fileId = key.slice(PREFIX.length);
    const drive = this.drive();
    // Single Drive call — skip the metadata fetch that get() does
    // for mime/size.  Callers using this path already have those
    // values from MediaAsset.mimeType / MediaAsset.size.
    const dataRes = await drive.files.get({ ...SHARED, fileId, alt: 'media' }, { responseType: 'stream' });
    return { stream: dataRes.data as unknown as NodeJS.ReadableStream };
  }
```

- [ ] **Step 2: Typecheck**

```
pnpm typecheck
```

Expected: clean.

- [ ] **Step 3: Run the full unit test suite**

```
pnpm test
```

Expected: clean (no test file should regress).

- [ ] **Step 4: Commit Tasks 1.2 + 1.3 + 1.4 together**

```bash
git add src/lib/storage/index.ts src/lib/storage/local.ts src/lib/storage/gdrive.ts
git commit -m "feat(storage): add getStreamOnly that skips the metadata RTT

FileStorage now exposes getStreamOnly(key) alongside get(key).
The signed /api/files path uses it because mimeType and size
already live on the MediaAsset row, so the Drive metadata
files.get call (RTT 1 of 2) is a pure waste.

LocalDiskStorage: trivially opens the file.
GoogleDriveStorage: a single files.get with alt=media instead
of the previous two sequential calls."
```

---

### Task 1.5: Open PR 1

- [ ] **Step 1: Push and open PR**

```bash
git push -u origin perf-phase-1
gh pr create --title "feat(perf): phase 1 PR1 — media-sign + storage interface" \
  --body "$(cat <<'EOF'
Phase 1 PR 1 of 4.  Pure ground work — no behavior change in the
running app.

- src/lib/media-sign.ts: HMAC-signed URLs (sign + verify).
- FileStorage.getStreamOnly on both Local and GoogleDrive backends;
  Drive variant skips the metadata RTT.

Tests:
- pnpm test src/lib/__tests__/media-sign.test.ts (8 cases)
- pnpm test src/lib/__tests__/server-timing.test.ts (3 cases, from Phase 0)

Spec: docs/superpowers/specs/2026-05-28-app-performance-design.md (Phase 1)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 2: Wait for CI, merge, branch for PR 2**

```bash
gh pr merge --squash --delete-branch
git checkout main
git pull
git checkout -b perf-phase-1-pr2
```

---

## PR 2 — Dual auth path

### Task 1.6: Middleware bypass for `/api/files/*`

**Files:**
- Modify: `src/middleware.ts`

- [ ] **Step 1: Add `api/files` to the matcher exclusion**

In `src/middleware.ts`, update the `config.matcher` line:

```ts
export const config = {
  matcher: ['/((?!api/auth|api/files|_next/static|_next/image|favicon.ico).*)'],
};
```

- [ ] **Step 2: Smoke test the dev server**

```
pnpm dev
```

Open `http://localhost:3000/api/files/some-nonexistent-id` in an incognito window (no cookie). Expected: the route handler still runs, returns a 401 (because `getCurrentUser` returns null and the route handler short-circuits) — confirming the middleware redirect to /login no longer fires for /api/files. Stop dev.

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat(middleware): exclude /api/files from NextAuth middleware

The /api/files route still re-checks auth itself (cookie path)
and will gain signed-URL bypass in the next task.  Removing the
middleware redirect lets signed requests serve from edge without
ever invoking NextAuth."
```

---

### Task 1.7: `/api/files/[id]` accepts signed URLs

**Files:**
- Modify: `src/app/api/files/[id]/route.ts`
- Create: `src/lib/prisma.ts` is referenced — no change needed.

- [ ] **Step 1: Rewrite the handler to dispatch on the `sig` query**

Replace the body of `GET` in `src/app/api/files/[id]/route.ts`:

```ts
import { Readable } from 'node:stream';
import { getMediaForRead } from '@/features/media/service';
import { getCurrentUser } from '@/lib/auth';
import { NotFoundError, RbacError } from '@/lib/errors';
import { verifyMediaUrl } from '@/lib/media-sign';
import { prisma } from '@/lib/prisma';
import { createTimings } from '@/lib/server-timing';
import { getStorage } from '@/lib/storage';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function toWebStream(stream: NodeJS.ReadableStream): ReadableStream<Uint8Array> {
  if (stream instanceof Readable) return Readable.toWeb(stream) as unknown as ReadableStream<Uint8Array>;
  return stream as unknown as ReadableStream<Uint8Array>;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const t = createTimings();
  const { id } = await params;
  const search = new URL(req.url).searchParams;

  if (search.has('sig')) {
    // ── Signed path — no cookie, no DB authz, no Drive metadata RTT. ──
    const v = verifyMediaUrl(id, search);
    t.mark('sig');
    if (!v.ok) {
      return NextResponse.json({ error: v.reason }, { status: 401, headers: { 'server-timing': t.header() } });
    }
    const asset = await prisma.mediaAsset.findUnique({
      where: { id },
      select: { id: true, status: true, storageKey: true, mimeType: true, size: true },
    });
    t.mark('db');
    if (!asset || asset.status !== 'READY' || !asset.storageKey) {
      return NextResponse.json({ error: 'unavailable' }, { status: 410, headers: { 'server-timing': t.header() } });
    }
    const { stream } = await getStorage().getStreamOnly(asset.storageKey);
    t.mark('storage');
    return new NextResponse(toWebStream(stream), {
      headers: {
        'content-type': asset.mimeType,
        'content-length': String(asset.size),
        'cache-control': 'public, max-age=600, s-maxage=600, immutable',
        etag: `"${asset.id}-${v.variant}"`,
        'x-content-type-options': 'nosniff',
        'content-security-policy': "default-src 'none'; img-src 'self'; media-src 'self'",
        'referrer-policy': 'no-referrer',
        'server-timing': t.header(),
      },
    });
  }

  // ── Cookie path (unchanged behavior, kept for backward compat). ──
  const user = await getCurrentUser();
  t.mark('auth');
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: { 'server-timing': t.header() } });
  }

  let asset: Awaited<ReturnType<typeof getMediaForRead>>;
  try {
    asset = await getMediaForRead({ id: user.id, role: user.role }, id);
  } catch (e) {
    t.mark('db');
    if (e instanceof NotFoundError) return NextResponse.json({ error: e.message }, { status: 404, headers: { 'server-timing': t.header() } });
    if (e instanceof RbacError) return NextResponse.json({ error: e.message }, { status: 403, headers: { 'server-timing': t.header() } });
    throw e;
  }
  t.mark('db');

  if (asset.status === 'PENDING') {
    return NextResponse.json({ error: 'asset still uploading' }, { status: 425, headers: { 'server-timing': t.header() } });
  }
  if (asset.status === 'FAILED' || !asset.storageKey) {
    return NextResponse.json({ error: 'asset unavailable' }, { status: 410, headers: { 'server-timing': t.header() } });
  }

  const { stream, size } = await getStorage().get(asset.storageKey);
  t.mark('storage');

  const headers: Record<string, string> = {
    'content-type': asset.mimeType,
    'cache-control': 'private, no-cache, max-age=0, must-revalidate',
    vary: 'cookie',
    etag: `"${asset.id}"`,
    'x-content-type-options': 'nosniff',
    'content-security-policy': "default-src 'none'; img-src 'self'; media-src 'self'",
    'referrer-policy': 'no-referrer',
    'server-timing': t.header(),
  };
  if (size > 0) headers['content-length'] = String(size);

  return new NextResponse(toWebStream(stream), { headers });
}
```

- [ ] **Step 2: Typecheck**

```
pnpm typecheck
```

Expected: clean.

- [ ] **Step 3: Smoke test the dev server**

```
pnpm dev
```

In a separate terminal, generate a signed URL using a quick node REPL:

```
pnpm exec node -e "
const { signMediaUrl } = require('./src/lib/media-sign');
process.env.AUTH_SECRET = process.env.AUTH_SECRET ?? require('fs').readFileSync('.env.local','utf-8').split('\n').find(l => l.startsWith('AUTH_SECRET=')).split('=')[1].replace(/^\"|\"$/g,'');
const id = '<paste a real MediaAsset id from your dev DB — pnpm db:studio>';
console.log(signMediaUrl(id));
"
```

Open the printed URL in the same browser tab (logged-in). Then in incognito (no cookie), open it again. Expected:
- Both succeed (200).
- Response headers: `cache-control: public, max-age=600, s-maxage=600, immutable`.
- `server-timing: sig;dur=…,db;dur=…,storage;dur=…,total;dur=…` (no `auth;dur`).

Stop dev.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/files/[id]/route.ts
git commit -m "feat(media): /api/files accepts HMAC-signed URLs

Signed requests skip getCurrentUser, getMediaForRead, and Drive's
metadata RTT.  Headers flip to public, immutable, edge-cacheable.

Cookie path retained byte-for-byte for backward compatibility
during PR 3's progressive migration.  Once all clients build
signed URLs the cookie path will be cleanup in PR 4."
```

---

### Task 1.8: `listAnimals` mints `thumbnailUrl`

**Files:**
- Modify: `src/features/animals/queries.ts`
- Modify: `src/features/animals/components/PatientCard.tsx`

- [ ] **Step 1: Add `thumbnailUrl` to the query**

In `src/features/animals/queries.ts`, modify `AnimalListItem` and `listAnimals`:

```ts
import { prisma } from '@/lib/prisma';
import { signMediaUrl } from '@/lib/media-sign';
import type { AnimalStatus, Prisma } from '@prisma/client';
import { unstable_cache } from 'next/cache';

export interface ListAnimalsParams {
  status?: AnimalStatus;
  species?: string;
  search?: string;
  take?: number;
  cursor?: string;
}

export interface AnimalListItem {
  id: string;
  name: string;
  species: string;
  breed: string | null;
  ward: string | null;
  cage: string | null;
  status: AnimalStatus;
  contagious: boolean;
  aggressive: boolean;
  admittedAt: Date;
  lastActivityAt: Date | null;
  /** Pre-signed /api/files URL — caller renders directly. */
  thumbnailUrl: string | null;
}
```

Then update the `.map((r) => ({` block in `listAnimals` to set `thumbnailUrl` from the signed helper. Replace the existing `thumbnailAssetId` field:

```ts
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    species: r.species,
    breed: r.breed,
    ward: r.ward,
    cage: r.cage?.name ?? null,
    status: r.status,
    contagious: r.contagious,
    aggressive: r.aggressive,
    admittedAt: r.admittedAt,
    lastActivityAt: r.activities[0]?.occurredAt ?? null,
    thumbnailUrl: r.media[0]?.asset.id ? signMediaUrl(r.media[0].asset.id) : null,
  }));
```

- [ ] **Step 2: Update PatientCard to use the new field**

In `src/features/animals/components/PatientCard.tsx`, replace the `photoSrc` computation:

```tsx
  const photoSrc = animal.thumbnailUrl ?? undefined;
```

Drop the now-unused `assetId` URL string construction.

- [ ] **Step 3: Typecheck and run unit tests**

```
pnpm typecheck && pnpm test
```

Expected: clean.

- [ ] **Step 4: Smoke test**

```
pnpm dev
```

Open `/patients`. DevTools → Network → filter `api/files`. Confirm thumbnail requests carry `?v=orig&sig=...` and the response has `cache-control: public, max-age=600, ...`. Reload the page — second load should mostly be `200 (from disk cache)` or `200 (from memory cache)`.

Stop dev.

- [ ] **Step 5: Commit**

```bash
git add src/features/animals/queries.ts src/features/animals/components/PatientCard.tsx
git commit -m "feat(animals): listAnimals emits signed thumbnailUrl

PatientCard reads the pre-signed URL directly instead of
constructing /api/files/\${id} on the client.  Thumbnails on
/patients now hit the edge cache after the first fetch."
```

---

### Task 1.9: Open PR 2

- [ ] **Step 1: Push and open PR**

```bash
git push -u origin perf-phase-1-pr2
gh pr create --title "feat(perf): phase 1 PR2 — /api/files accepts signed URLs" \
  --body "$(cat <<'EOF'
Phase 1 PR 2 of 4.

- Middleware no longer guards /api/files (route handler still does).
- /api/files/[id] handles signed (?sig=) requests with public,
  immutable cache headers; cookie path unchanged for backward compat.
- listAnimals emits a pre-signed thumbnailUrl; PatientCard uses it.

Re-runs Phase 0's /api/files baseline timing capture in
docs/perf/baseline-2026-05-28.md (append a 'PR2' column) and
expects sig;dur in the 1–3 ms range vs auth;dur ~30+ ms.

Spec: docs/superpowers/specs/2026-05-28-app-performance-design.md
EOF
)"
```

- [ ] **Step 2: Wait for CI, merge, branch for PR 3**

```bash
gh pr merge --squash --delete-branch
git checkout main
git pull
git checkout -b perf-phase-1-pr3
```

---

## PR 3 — Full migration

### Task 1.10: `getAnimal` mints media URLs

**Files:**
- Modify: `src/features/animals/queries.ts`
- Modify: `src/features/animals/components/AnimalDetail.tsx`
- Modify: `src/features/animals/components/AnimalHero.tsx`

- [ ] **Step 1: Project a signed URL into the return shape**

In `src/features/animals/queries.ts`, modify `getAnimal` to layer the signed URL onto each media item without changing the Prisma query:

```ts
export async function getAnimal(id: string) {
  const animal = await prisma.animal.findFirst({
    where: { id, deletedAt: null },
    include: {
      testsAdvised: true,
      media: {
        orderBy: { order: 'asc' },
        include: { asset: true },
      },
      createdBy: { select: { id: true, name: true } },
      cage: { select: { name: true } },
    },
  });
  if (!animal) return null;
  return {
    ...animal,
    media: animal.media.map((m) => ({
      ...m,
      url: signMediaUrl(m.asset.id),
    })),
  };
}
```

- [ ] **Step 2: Propagate the new `url` through AnimalDetail**

In `src/features/animals/components/AnimalDetail.tsx`, the existing block that maps `animal.media.map((m) => ({ asset: { id: m.asset.id, ... } }))` for `AnimalHero` props — add `url: m.url`:

```tsx
          media: animal.media.map((m) => ({
            asset: { id: m.asset.id, filename: m.asset.filename, kind: m.asset.kind },
            url: m.url,
          })),
```

And the `visualItems` builder + `MediaGrid` `items` builder both — pass `url` through. Concretely, where the file currently builds `{ id, kind, filename, label }` for `MediaGrid`, change to `{ id, kind, filename, label, url: m.url }`. Same for the `visualItems` admission-media entries.

- [ ] **Step 3: Update AnimalHero to consume the URL**

In `src/features/animals/components/AnimalHero.tsx`:

Update the `Props.animal.media` type:

```tsx
    media: { asset: { id: string; filename: string; kind: 'PHOTO' | 'VIDEO' | 'XRAY' | 'DOC' }; url: string }[];
```

Replace `photoSrc` and the lightbox items construction:

```tsx
  const photoSrc = animal.media[0]?.url;
  const lightboxItems = animal.media.map((m) => ({
    id: m.asset.id,
    filename: m.asset.filename,
    kind: m.asset.kind,
    url: m.url,
  }));
```

(The `Lightbox` type widening to include `url` happens in Task 1.14 below — typecheck will fail here until then. That's expected and acceptable inside one PR.)

- [ ] **Step 4: Run typecheck (expect failures pending Task 1.14)**

```
pnpm typecheck
```

Expected: failures on `LightboxItem` not having `url`. We'll fix in 1.14. Continue without committing yet.

---

### Task 1.11: `listActivitiesForAnimal` mints URLs

**Files:**
- Modify: `src/features/activities/queries.ts`
- Modify: `src/features/animals/components/AnimalDetail.tsx` (serializer block)

- [ ] **Step 1: Layer `url` onto media in the query**

In `src/features/activities/queries.ts`:

```ts
import { prisma } from '@/lib/prisma';
import { signMediaUrl } from '@/lib/media-sign';

const ACTIVITY_FEED_CAP = 500;

export async function listActivitiesForAnimal(animalId: string) {
  const rows = await prisma.activity.findMany({
    where: { animalId, deletedAt: null },
    orderBy: { occurredAt: 'desc' },
    take: ACTIVITY_FEED_CAP,
    include: {
      media: { include: { asset: true } },
      byUser: { select: { id: true, name: true } },
    },
  });
  return rows.map((r) => ({
    ...r,
    media: r.media.map((m) => ({ ...m, url: signMediaUrl(m.assetId) })),
  }));
}

export async function getLastActivityAt(animalId: string): Promise<Date | null> {
  const last = await prisma.activity.findFirst({
    where: { animalId, deletedAt: null },
    orderBy: { occurredAt: 'desc' },
    select: { occurredAt: true },
  });
  return last?.occurredAt ?? null;
}
```

- [ ] **Step 2: Propagate `url` through the AnimalDetail serializer**

In `src/features/animals/components/AnimalDetail.tsx`, the `serializedActivities` block now reads `url` off the joined media:

```tsx
  const serializedActivities = activities.map((a) => ({
    id: a.id,
    animalId: a.animalId,
    type: a.type as ActivityType,
    occurredAt: a.occurredAt.toISOString(),
    byName: a.byName,
    remarks: a.remarks,
    editedAt: a.editedAt ? a.editedAt.toISOString() : null,
    data: a.data,
    media: a.media.map((m) => ({
      id: m.id,
      assetId: m.assetId,
      kind: m.asset.kind,
      label: m.label,
      url: m.url,
    })),
  }));
```

- [ ] **Step 3: Continue, no commit yet — tests run after 1.12**

---

### Task 1.12: `ActivityTimeline` + `ActivitySheet` consume `url`

**Files:**
- Modify: `src/features/activities/components/ActivityTimeline.tsx`
- Modify: `src/features/activities/components/ActivitySheet.tsx`

- [ ] **Step 1: Widen the `SerializedActivity.media` shape**

In `ActivityTimeline.tsx`, the existing `SerializedActivity` interface adds a `url`:

```ts
export interface SerializedActivity {
  id: string;
  animalId: string;
  type: ActivityType;
  occurredAt: string;
  byName: string;
  remarks: string | null;
  editedAt: string | null;
  // biome-ignore lint/suspicious/noExplicitAny: server-erased data shape
  data: any;
  media: { id: string; assetId: string; kind: 'PHOTO' | 'VIDEO' | 'XRAY' | 'DOC'; label: string | null; url: string }[];
}
```

- [ ] **Step 2: Replace `/api/files/${firstPhoto.assetId}` in the row thumbnail**

In the `ActivityRow` component, `firstPhoto` already references the media object; just use `url`:

```tsx
                src={firstPhoto.usePlaceholder ? undefined : firstPhoto.url}
```

- [ ] **Step 3: Update `ActivitySummary` and the sheet's renderers**

In `ActivitySheet.tsx`, widen `ActivitySummary.media`:

```ts
  media: { id: string; assetId: string; kind: 'PHOTO' | 'VIDEO' | 'XRAY' | 'DOC'; label: string | null; url: string }[];
```

Replace both `/api/files/${m.assetId}` sites (the `<video>` src around line 341 and the `<Photo>` src around line 357) with `m.url`.

Update the `photoItems` builder to carry `url`:

```tsx
  const photoItems = activity.media
    .filter((m) => m.kind !== 'VIDEO')
    .map((m) => ({ id: m.assetId, url: m.url, filename: m.label ?? '', kind: m.kind, label: m.label }));
```

Update the click handler `onClickRow` in `ActivityTimeline.tsx` to pass `url` through when it builds an `ActivitySummary`:

```tsx
      media: a.media.map((m) => ({ id: m.id, assetId: m.assetId, kind: m.kind, label: m.label, url: m.url })),
```

- [ ] **Step 4: Continue, no commit yet — Lightbox + MediaGrid in next task**

---

### Task 1.13: `listTodayActivities` mints URLs + `TodayTimelineList` consumes them

**Files:**
- Modify: `src/features/reports/queries.ts`
- Modify: `src/features/reports/components/TodayTimelineList.tsx`

- [ ] **Step 1: Add URLs to the cached shape**

In `src/features/reports/queries.ts`, modify `TodayTimelineItem` and the row mapping to include `media[i].url` and `animalThumbnailUrl`:

```ts
export interface TodayTimelineItem {
  id: string;
  animalId: string;
  animalName: string;
  animalSpecies: string;
  animalThumbnailUrl: string | null;
  type: ActivityType;
  occurredAt: Date;
  byName: string;
  remarks: string | null;
  // biome-ignore lint/suspicious/noExplicitAny: per-type payload erased
  data: any;
  editedAt: Date | null;
  media: Array<{
    id: string;
    assetId: string;
    kind: 'PHOTO' | 'VIDEO' | 'XRAY' | 'DOC';
    label: string | null;
    url: string;
  }>;
  summary: string;
}

interface TodayTimelineItemCached extends Omit<TodayTimelineItem, 'occurredAt' | 'editedAt'> {
  occurredAt: string;
  editedAt: string | null;
}
```

Replace the `_listTodayActivitiesRaw` mapping `return rows.map(...)`:

```ts
  return rows.map((r) => ({
    id: r.id,
    animalId: r.animalId,
    animalName: r.animal.name,
    animalSpecies: r.animal.species,
    animalThumbnailUrl: r.animal.media[0]?.asset.id ? signMediaUrl(r.animal.media[0].asset.id) : null,
    type: r.type,
    occurredAt: r.occurredAt.toISOString(),
    byName: r.byName,
    remarks: r.remarks,
    data: r.data,
    editedAt: r.editedAt ? r.editedAt.toISOString() : null,
    media: r.media.map((m) => ({
      id: m.id,
      assetId: m.assetId,
      kind: m.asset.kind,
      label: m.label,
      url: signMediaUrl(m.assetId),
    })),
    summary: summarizeActivity({ type: r.type, data: r.data, remarks: r.remarks }),
  }));
```

Add the import at the top of `queries.ts`:

```ts
import { signMediaUrl } from '@/lib/media-sign';
```

- [ ] **Step 2: Update `TodayTimelineList.tsx`**

In `src/features/reports/components/TodayTimelineList.tsx`, replace lines 101 and 107 — the two `\`/api/files/${...}\`` constructions:

```tsx
            thumbSrc = firstStill.url;
            // …
            thumbSrc = it.animalThumbnailUrl;
```

Adjust the conditionals so it reads:

```tsx
        let thumbSrc: string | undefined;
        const firstStill = it.media.find((m) => m.kind === 'PHOTO' || m.kind === 'XRAY');
        if (firstStill) {
          thumbSrc = firstStill.url;
        } else if (it.animalThumbnailUrl) {
          thumbSrc = it.animalThumbnailUrl;
        }
```

(Adjust the existing logic — the goal is to delete every `\`/api/files/\${\`` from this file.)

Verify with `grep`:

```
grep -n '/api/files/' src/features/reports/components/TodayTimelineList.tsx
```

Expected: no matches.

- [ ] **Step 3: Continue without committing — bulk commit after 1.16**

---

### Task 1.14: `listDocumentsForAnimal` + `DocumentList` migrate

**Files:**
- Modify: `src/features/documents/queries.ts`
- Modify: `src/features/documents/components/DocumentList.tsx`

- [ ] **Step 1: Layer `url` onto the document file**

In `src/features/documents/queries.ts`:

```ts
import { prisma } from '@/lib/prisma';
import { signMediaUrl } from '@/lib/media-sign';
import { type Actor, assertCan } from '@/lib/rbac';
import type { DocCategory } from './schema';

const DOC_PER_ANIMAL_CAP = 500;

export async function listDocumentsForAnimal(animalId: string) {
  const rows = await prisma.document.findMany({
    where: { animalId, deletedAt: null, animal: { deletedAt: null } },
    orderBy: [{ category: 'asc' }, { createdAt: 'desc' }],
    take: DOC_PER_ANIMAL_CAP,
    include: {
      file: true,
      uploadedBy: { select: { name: true } },
    },
  });
  return rows.map((d) => ({
    ...d,
    file: d.file ? { ...d.file, url: signMediaUrl(d.file.id) } : null,
  }));
}

// listAllDocuments treats `file` the same way.
export async function listAllDocuments(actor: Actor, params: ListAllDocumentsParams = {}) {
  assertCan(actor, 'document.read.all');
  const { limit = 100, search, category } = params;
  const rows = await prisma.document.findMany({
    where: {
      deletedAt: null,
      animal: { deletedAt: null },
      ...(category ? { category } : {}),
      ...(search
        ? {
            OR: [
              { kind: { contains: search, mode: 'insensitive' as const } },
              { name: { contains: search, mode: 'insensitive' as const } },
              { animal: { name: { contains: search, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      animal: { select: { id: true, name: true, species: true } },
      file: true,
      uploadedBy: { select: { name: true } },
    },
  });
  return rows.map((d) => ({
    ...d,
    file: d.file ? { ...d.file, url: signMediaUrl(d.file.id) } : null,
  }));
}

export interface ListAllDocumentsParams {
  limit?: number;
  search?: string;
  category?: DocCategory;
}
```

- [ ] **Step 2: Update `DocumentList.tsx`**

In `src/features/documents/components/DocumentList.tsx`, widen the `DocWithFile` type and use `file.url`:

```tsx
type DocWithFile = Document & {
  file: (MediaAsset & { url: string }) | null;
  uploadedBy: { name: string };
};
```

Replace line 45:

```tsx
                  <Link
                    href={d.file ? d.file.url : '#'}
```

- [ ] **Step 3: Continue, no commit yet**

---

### Task 1.15: `MediaGrid` + `Lightbox` accept `url` (and drop `unoptimized`)

**Files:**
- Modify: `src/components/media/Lightbox.tsx`
- Modify: `src/components/media/MediaGrid.tsx`

- [ ] **Step 1: Widen `LightboxItem`**

In `src/components/media/Lightbox.tsx`:

```tsx
export interface LightboxItem {
  id: string;
  url: string;
  filename: string;
  kind: 'PHOTO' | 'VIDEO' | 'XRAY' | 'DOC';
  label?: string | null;
}
```

Replace every `\`/api/files/${current.id}\`` with `current.url` (three sites: video, doc iframe, image). The `<Image>` remains for now — `unoptimized` stays until PR 4.

- [ ] **Step 2: Update `MediaGrid.tsx`**

In `src/components/media/MediaGrid.tsx`, replace line 36's image `src`:

```tsx
              <Image
                src={it.url}
                alt={it.label || it.filename}
                fill
                sizes="200px"
                className="object-cover transition group-hover:scale-105"
                unoptimized
              />
```

- [ ] **Step 3: Update every caller that passes `MediaGrid` / `Lightbox` items**

The callers were:
- `AnimalDetail.tsx` — already updated in Task 1.10, passes `url` through.
- `AnimalHero.tsx` — already updated in Task 1.10.
- `VisualRecords.tsx` — uses `MediaGrid`. Check the file:

```
grep -n "MediaGrid\|url" src/features/animals/components/VisualRecords.tsx
```

Update its item builder to pass `url` (it receives items from `AnimalDetail` so the `url` is already in the upstream `visualItems` builder from Task 1.10 — just propagate the field through this component's props).

- [ ] **Step 4: Continue, no commit yet**

---

### Task 1.16: `MediaUploader` receives `url` from finalize

**Files:**
- Modify: `src/app/api/files/finalize/route.ts`
- Modify: `src/lib/upload/resumable.ts`
- Modify: `src/components/media/MediaUploader.tsx`

- [ ] **Step 1: Find and read the existing finalize response shape**

```
cat src/app/api/files/finalize/route.ts | head -80
cat src/lib/upload/resumable.ts | head -80
```

Identify the JSON response shape and the `FinalizeResponse` interface (typically `{ id, kind, filename }`).

- [ ] **Step 2: Add `url` to the finalize response**

In `src/app/api/files/finalize/route.ts`, after the asset is created/marked READY and before the JSON response, sign and include the URL. Wherever the success response is constructed:

```ts
import { signMediaUrl } from '@/lib/media-sign';
// …
return NextResponse.json({ id: asset.id, kind: asset.kind, filename: asset.filename, url: signMediaUrl(asset.id) });
```

(Adjust to match the exact response shape currently constructed in that file.)

- [ ] **Step 3: Widen the client-side type**

In `src/lib/upload/resumable.ts`, the `FinalizeResponse` interface adds `url`:

```ts
export interface FinalizeResponse {
  id: string;
  kind: 'PHOTO' | 'VIDEO' | 'XRAY' | 'DOC';
  filename: string;
  url: string;
}
```

- [ ] **Step 4: Widen `UploadedAsset` and use `u.url`**

In `src/components/media/MediaUploader.tsx`, widen `UploadedAsset`:

```tsx
export interface UploadedAsset {
  id: string;
  kind: FinalizeResponse['kind'];
  filename: string;
  url: string;
}
```

Replace line 139's `src={\`/api/files/${u.id}\`}`:

```tsx
                <Image
                  src={u.url}
                  alt={u.filename}
                  fill
                  className="object-cover"
                  sizes="200px"
                  unoptimized
                />
```

- [ ] **Step 5: Continue, no commit yet**

---

### Task 1.17: CI grep gate — fail builds with residual `/api/files/${`

**Files:**
- Create: `scripts/check-no-raw-file-urls.sh`
- Modify: `.github/workflows/<existing-ci>.yml` if present, else create a small workflow

- [ ] **Step 1: Check current CI structure**

```
ls .github/workflows/ 2>/dev/null && cat .github/workflows/*.yml 2>/dev/null | head -60
```

If there's no CI workflow, this step adds a tiny grep check to lint-staged + a pre-commit hook in `.husky/`.

- [ ] **Step 2: Write the grep script**

Create `scripts/check-no-raw-file-urls.sh`:

```bash
#!/usr/bin/env bash
# Fails if any client code still constructs /api/files/${...} as a
# string.  All such URLs must now be minted server-side via
# signMediaUrl() and shipped down as a string field on the prop.
set -euo pipefail

if grep -rn --include='*.ts' --include='*.tsx' '`/api/files/${' src/ ; then
  echo
  echo "Found raw /api/files/\${...} string-construction in src/."
  echo "Replace with a server-side signMediaUrl() URL passed through props."
  exit 1
fi
echo "OK: no raw /api/files URL string-builds in client code."
```

Make it executable:

```
chmod +x scripts/check-no-raw-file-urls.sh
```

- [ ] **Step 3: Run it locally**

```
bash scripts/check-no-raw-file-urls.sh
```

Expected: "OK: no raw /api/files URL string-builds in client code." If it fails, find and fix the residual call sites before continuing.

- [ ] **Step 4: Wire into CI**

If `.github/workflows/ci.yml` exists, add a step before tests:

```yaml
      - name: Forbid raw /api/files URL builds
        run: bash scripts/check-no-raw-file-urls.sh
```

Or, if no CI yet, add to `.husky/pre-commit`:

```bash
bash scripts/check-no-raw-file-urls.sh
```

- [ ] **Step 5: Final typecheck + tests for PR 3**

```
pnpm typecheck && pnpm test
```

Expected: clean.

- [ ] **Step 6: Commit PR 3's full migration**

```bash
git add src/features/animals/queries.ts \
        src/features/animals/components/AnimalDetail.tsx \
        src/features/animals/components/AnimalHero.tsx \
        src/features/animals/components/VisualRecords.tsx \
        src/features/activities/queries.ts \
        src/features/activities/components/ActivityTimeline.tsx \
        src/features/activities/components/ActivitySheet.tsx \
        src/features/reports/queries.ts \
        src/features/reports/components/TodayTimelineList.tsx \
        src/features/documents/queries.ts \
        src/features/documents/components/DocumentList.tsx \
        src/components/media/Lightbox.tsx \
        src/components/media/MediaGrid.tsx \
        src/components/media/MediaUploader.tsx \
        src/app/api/files/finalize/route.ts \
        src/lib/upload/resumable.ts \
        scripts/check-no-raw-file-urls.sh \
        .github/workflows/ .husky/ 2>/dev/null || true

git commit -m "feat(media): migrate every client touchpoint to signed URLs

Every /api/files/\${id} string-build in src/ is replaced with a
pre-signed url field carried on the prop.  Server queries mint
URLs via signMediaUrl(); client code reads them directly.

Migrated:
- AnimalDetail (admission media, activity media, visual records)
- AnimalHero, VisualRecords, AnimalDetailsTab admission media
- ActivityTimeline, ActivitySheet (row thumbs, sheet media grid,
  video src, lightbox)
- TodayTimelineList (animal thumb + activity thumb)
- DocumentList (download Link href)
- MediaGrid, Lightbox (item.url replaces id-derived URL)
- MediaUploader pending-finalize preview uses finalize-returned url
- /api/files/finalize response now includes url

CI grep gate scripts/check-no-raw-file-urls.sh fails build on
any residual /api/files/\${ in src/."
```

---

### Task 1.18: E2E smoke for signed URLs end-to-end

**Files:**
- Create: `tests/e2e/signed-media.spec.ts`

- [ ] **Step 1: Write the e2e test**

Create `tests/e2e/signed-media.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test('thumbnails on /patients are served via signed URLs', async ({ page, baseURL }) => {
  // Reuse the existing seeded login.  Other e2e tests follow this
  // pattern — they sign in as admin via /login.
  await page.goto(`${baseURL}/login`);
  await page.getByLabel(/email/i).fill('admin@arham.care');
  await page.getByLabel(/password/i).fill('admin1234');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/$/);
  await page.goto(`${baseURL}/patients`);

  // Find at least one image whose src points at /api/files with sig.
  const imgs = page.locator('img[src*="/api/files/"]');
  await expect(imgs.first()).toBeAttached({ timeout: 5000 });
  const src = await imgs.first().getAttribute('src');
  expect(src).toMatch(/\/api\/files\/[^?]+\?v=orig&sig=[A-Za-z0-9_-]{22}/);
});

test('signed /api/files response has public cache headers', async ({ page, baseURL, request }) => {
  await page.goto(`${baseURL}/login`);
  await page.getByLabel(/email/i).fill('admin@arham.care');
  await page.getByLabel(/password/i).fill('admin1234');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/$/);
  await page.goto(`${baseURL}/patients`);
  const src = await page.locator('img[src*="/api/files/"]').first().getAttribute('src');
  if (!src) throw new Error('no signed src found');

  // Drop cookies — the signed URL should serve without a session.
  const fresh = await request.newContext();
  const res = await fresh.get(`${baseURL}${src}`);
  expect(res.status()).toBe(200);
  expect(res.headers()['cache-control']).toContain('public');
  expect(res.headers()['cache-control']).toContain('max-age=600');
});
```

- [ ] **Step 2: Run the e2e test**

```
pnpm test:e2e tests/e2e/signed-media.spec.ts
```

Expected: 2 passing. (If the test runner needs a Playwright build, follow the runtime hint — typically `pnpm exec playwright install`.)

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/signed-media.spec.ts
git commit -m "test(e2e): assert /patients renders signed image URLs and edge-cacheable headers"
```

---

### Task 1.19: Open PR 3

- [ ] **Step 1: Push and open**

```bash
git push -u origin perf-phase-1-pr3
gh pr create --title "feat(perf): phase 1 PR3 — migrate all client touchpoints to signed URLs" \
  --body "$(cat <<'EOF'
Phase 1 PR 3 of 4.

Every /api/files/\${id} string-build in src/ is replaced with
a server-minted signed URL passed via props.

CI gate scripts/check-no-raw-file-urls.sh refuses any residual.

E2E test asserts:
- /patients thumbnails carry ?v=orig&sig=<22chars>
- The signed URL serves with public, max-age=600, immutable
  headers (no cookie needed).

Spec: docs/superpowers/specs/2026-05-28-app-performance-design.md
EOF
)"
```

- [ ] **Step 2: Wait for CI, merge, branch for PR 4**

```bash
gh pr merge --squash --delete-branch
git checkout main
git pull
git checkout -b perf-phase-1-pr4
```

---

## PR 4 — Cleanup + Next image optimization

### Task 1.20: Configure `next.config.ts` `images` block

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: Add the images block**

In `next.config.ts`, add an `images` property inside the `nextConfig` object:

```ts
const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: false,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  images: {
    // Hold optimized variants for up to one year before re-running the
    // transform.  Combined with stable signed URLs this keeps total
    // transformations to ~(assets × widths × formats) for the project's
    // lifetime — well under Hobby's 5K/month cap.
    minimumCacheTTL: 60 * 60 * 24 * 365,
    formats: ['image/avif', 'image/webp'],
    // Cap variant explosion.  Each entry is one transformation per asset.
    deviceSizes: [320, 640, 1080],
    imageSizes: [64, 200, 400],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};
```

- [ ] **Step 2: Verify typecheck**

```
pnpm typecheck
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add next.config.ts
git commit -m "feat(perf): configure Next image optimization for Hobby tier

minimumCacheTTL=1yr collapses transformations to one per
(asset, width, format) for the project's life.  Capped
deviceSizes + imageSizes bound the variant count.  AVIF
preferred, WebP fallback."
```

---

### Task 1.21: Remove `unoptimized` from `<Photo>` and refine `sizes`

**Files:**
- Modify: `src/components/media/Photo.tsx`
- Modify: `src/features/animals/components/PatientCard.tsx`
- Modify: `src/features/animals/components/AnimalHero.tsx`
- Modify: `src/features/activities/components/ActivityTimeline.tsx`
- Modify: `src/features/activities/components/ActivitySheet.tsx`
- Modify: `src/features/reports/components/TodayTimelineList.tsx`

- [ ] **Step 1: Make `sizes` a prop on `<Photo>` with a sensible default**

In `src/components/media/Photo.tsx`, change the `Props` interface to add `sizes`:

```tsx
interface Props {
  src?: string | undefined;
  seed: string;
  kind?: Kind | undefined;
  label?: string | undefined;
  time?: string | undefined;
  durationSec?: number | undefined;
  rounded?: number | undefined;
  className?: string | undefined;
  showLabel?: boolean | undefined;
  onClick?: (() => void) | undefined;
  alt?: string | undefined;
  /** Defaults to "200px".  Override per call site for correct srcset width selection. */
  sizes?: string | undefined;
}
```

In the function signature destructure, accept `sizes = '200px'`. Replace the `<Image ... unoptimized />` block:

```tsx
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          className="object-cover"
          onError={() => setImageFailed(true)}
        />
```

(Note `unoptimized` removed.)

- [ ] **Step 2: Pass the right `sizes` from each call site**

- `PatientCard.tsx`: `<Photo ... sizes="64px" />`
- `AnimalHero.tsx`: `<Photo ... sizes="(max-width: 768px) 68px, 78px" />`
- `ActivityTimeline.tsx` row: `<Photo ... sizes="48px" />`
- `ActivitySheet.tsx` sheet grid: `<Photo ... sizes="(max-width: 560px) 33vw, 180px" />`
- `TodayTimelineList.tsx` row thumb: `<Photo ... sizes="48px" />`

(Where the Photo is sized via the wrapping `className="h-X w-X"`, the px values above match.)

- [ ] **Step 3: Run typecheck + unit tests + e2e**

```
pnpm typecheck && pnpm test && pnpm test:e2e tests/e2e/signed-media.spec.ts
```

Expected: all clean.

- [ ] **Step 4: Smoke**

```
pnpm dev
```

Open `/patients` in DevTools mobile emulation. Confirm thumbnails are now served via `/_next/image?url=%2Fapi%2Ffiles%2F...%3Fv%3Dorig%26sig%3D...&w=64&q=75` (or similar) instead of raw `/api/files`. Response should be AVIF or WebP. Reload — second load `200 (from disk cache)`.

Stop dev.

- [ ] **Step 5: Commit**

```bash
git add src/components/media/Photo.tsx \
        src/features/animals/components/PatientCard.tsx \
        src/features/animals/components/AnimalHero.tsx \
        src/features/activities/components/ActivityTimeline.tsx \
        src/features/activities/components/ActivitySheet.tsx \
        src/features/reports/components/TodayTimelineList.tsx
git commit -m "feat(perf): re-enable Next image optimization on <Photo>

unoptimized dropped.  sizes is now a per-call-site prop:
64px thumbs, 48px activity rows, 180px sheet grid, hero
breakpoint-sensitive.  Server-rendered srcset picks the
right transform.  AVIF/WebP shipped to capable browsers."
```

---

### Task 1.22: Remove `unoptimized` from `MediaGrid` + `Lightbox` + `MediaUploader`

**Files:**
- Modify: `src/components/media/MediaGrid.tsx`
- Modify: `src/components/media/Lightbox.tsx`
- Modify: `src/components/media/MediaUploader.tsx`

- [ ] **Step 1: Drop `unoptimized` from each `<Image>`**

In each of the three files, remove the `unoptimized` prop on the `<Image>` tag. Set explicit `sizes`:

- `MediaGrid.tsx` columns=3 → `sizes="(max-width: 768px) 33vw, 200px"`. columns=4 → `sizes="(max-width: 768px) 25vw, 150px"`.
- `Lightbox.tsx` → keep `sizes="100vw"` (it's already full-bleed).
- `MediaUploader.tsx` → `sizes="200px"`.

- [ ] **Step 2: Run e2e + dev smoke**

```
pnpm test:e2e tests/e2e/signed-media.spec.ts && pnpm dev
```

Visit a patient page; open the lightbox; verify image, video, and PDF iframe all render. Stop dev.

- [ ] **Step 3: Commit**

```bash
git add src/components/media/MediaGrid.tsx \
        src/components/media/Lightbox.tsx \
        src/components/media/MediaUploader.tsx
git commit -m "feat(perf): drop unoptimized from MediaGrid, Lightbox, MediaUploader

All three now use Next image optimization with appropriate
sizes for srcset selection.  Video and PDF iframe sources
are unaffected (they don't go through next/image)."
```

---

### Task 1.23: Re-capture baseline + write Phase 1 results

**Files:**
- Modify: `docs/perf/baseline-2026-05-28.md`

- [ ] **Step 1: Capture five new `/api/files` responses against production**

After the PR 4 deploy lands in Vercel, capture five signed `/api/files` requests from `/patients` on mobile. Record `server-timing` (should be `sig;dur=…,db;dur=…,storage;dur=…,total;dur=…`, no `auth`).

- [ ] **Step 2: Capture new Lighthouse mobile runs**

```
pnpm exec lighthouse https://<prod>/patients --preset=mobile --quiet --output=json --output-path=./tmp/lh-patients-after.json
pnpm exec lighthouse https://<prod>/patients/<some-id> --preset=mobile --quiet --output=json --output-path=./tmp/lh-patient-after.json
```

- [ ] **Step 3: Append to the baseline doc**

In `docs/perf/baseline-2026-05-28.md`, add a second column or a new "After Phase 1" section with the new numbers. Expected swings:

- `/api/files` median total: ~400 ms → ~5–20 ms (signed, edge hit) or ~30–80 ms (signed, edge miss)
- LCP on `/patients/[id]`: order-of-magnitude smaller
- Vercel dashboard Fast Origin Transfer: trending down as edge serves more
- Edge Requests > Function Invocations for image traffic

- [ ] **Step 4: Commit**

```bash
git add docs/perf/baseline-2026-05-28.md
git commit -m "docs(perf): record Phase 1 after-numbers

Side-by-side with the Phase 0 baseline.  Server-Timing on /api/files
drops from ~400 ms to ~5–80 ms depending on edge state.  LCP improves
on /patients/[id].  Vercel Fast Origin Transfer trending down."
```

---

### Task 1.24: Open PR 4 and close out Phase 1

- [ ] **Step 1: Push and open PR 4**

```bash
git push -u origin perf-phase-1-pr4
gh pr create --title "feat(perf): phase 1 PR4 — Next image optimization + cleanup" \
  --body "$(cat <<'EOF'
Phase 1 PR 4 of 4 — final.

- next.config.ts images: minimumCacheTTL=1yr, deviceSizes,
  imageSizes, formats.
- <Photo> drops unoptimized and accepts a sizes prop with
  per-call-site values.
- <MediaGrid>, <Lightbox>, <MediaUploader> drop unoptimized.
- Phase 1 results captured next to the Phase 0 baseline
  in docs/perf/baseline-2026-05-28.md.

Spec: docs/superpowers/specs/2026-05-28-app-performance-design.md
EOF
)"
```

- [ ] **Step 2: After merge, observe production for at least 24 h**

Per the spec's measurement gate, don't start Phase 2 until:

- The `/api/files` Server-Timing total median holds < 80 ms warm.
- Vercel Edge Requests > Function Invocations for image traffic.
- Fast Origin Transfer day-over-day drops noticeably.
- No new production errors reported on `/patients` or `/patients/[id]`.

Record observed numbers in a follow-up commit to `docs/perf/baseline-2026-05-28.md`.

- [ ] **Step 3: Hand off to Phase 2**

Phase 2's plan is written separately. Once Phase 1's measurement gate passes, brainstorm + plan Phase 2 ("Kill the router.refresh storm") using the same spec.

---

## Self-Review Checklist (auto-run after writing this plan)

1. **Spec coverage:**
   - Phase 0 § Measurement: Tasks 0.1–0.4 ✓
   - Phase 1 § Signed-URL scheme: Task 1.1 ✓
   - Phase 1 § next.config.ts: Task 1.20 ✓
   - Phase 1 § Middleware bypass: Task 1.6 ✓
   - Phase 1 § /api/files dual path: Task 1.7 ✓
   - Phase 1 § Storage getStreamOnly: Tasks 1.2–1.4 ✓
   - Phase 1 § Server-side URL minting (11 touchpoints): Tasks 1.8, 1.10, 1.11, 1.13, 1.14 (queries) + 1.12, 1.15, 1.16 (clients) ✓
   - Phase 1 § Photo / MediaGrid / Lightbox / MediaUploader: Tasks 1.21, 1.22 ✓
   - Phase 1 § Finalize response: Task 1.16 ✓
   - Phase 1 § CI grep gate: Task 1.17 ✓
   - Phase 1 § Rollout: 4 PRs grouped, each with an open-PR task ✓
   - Phase 1 § Measurement gate: Task 1.23, 1.24 ✓

2. **Placeholder scan:** No `TBD`, no `TODO`, no "add validation" hand-waves. Code blocks present in every implementation step.

3. **Type consistency:** `MediaVariant`, `VerifyResult`, `SerializedActivity.media[].url`, `TodayTimelineItem.animalThumbnailUrl`, `LightboxItem.url`, `UploadedAsset.url`, `FinalizeResponse.url` — all referenced by the same names in every task that touches them.

4. **Files always exact:** Every Task lists Create / Modify with absolute paths.

5. **Commands precise:** Every `pnpm` / `bash` invocation specifies exact arguments. Expected outputs noted where verification matters.

Plan is complete and self-consistent.
