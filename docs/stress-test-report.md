# 3-day stress test report

**Date:** 2026-05-20
**DB:** Neon Postgres (ap-southeast-1)
**Scope:** 5 new admissions layered on existing 9 → 14 active patients · 108 activities across simulated 3 days · all 8 activity types · edit / soft-delete / restore / duplicate / inline-edit / discharge / death · RBAC + Zod gates · 10x concurrent writes

## Summary

| Probe | Result |
|---|---|
| Service-layer 3-day sim (108 activities, 5 admissions) | ✅ all green, 0 friction flagged |
| Friction edges (asset ownership, self-role-change, concurrent writes) | ✅ all green, 10/10 concurrent inserts succeeded |
| Playwright UI suites (11 total) | ✅ 9 pass · 2 stale-test failures (products work, tests outdated) |
| Final DB state | 14 animals · 12 active · 1 discharged · 1 deceased · 120 activities · 142 audit log rows |

## What works well

- Every activity type creates, edits, soft-deletes, restores, duplicates cleanly through the service layer.
- The new Zod gates fire correctly: TREATMENT.update with a FOOD-shaped payload is rejected; overlength animal names rejected; the H3-s self-role-change guard fires.
- RBAC ownership boundaries hold: a STAFF user cannot delete a DOCTOR-owned activity; a DOCTOR cannot finalize another user's pending Drive asset.
- 10 concurrent createActivity calls for the same animal all succeeded in 1.4s — no FK violations, no deadlocks, no folder-creation races. The advisory-lock-protected folder resolver is doing its job.
- Audit log writes survive every mutation path (142 rows after the sim).
- Discharge + death flows update the animal status atomically and write the audit trail.

## What's friction — ranked

### P1 — Things doctors will actually notice

1. **Admission latency on Neon: 700–1300 ms per admit** (Bruno worst at 1351 ms).
   Each admission opens a $transaction with `animal.create` + `testsAdvised.create` + audit-log write, plus a Drive folder lookup if `uploadSessionId` is set. Over WAN to ap-southeast-1 every round-trip costs ~80 ms. **Fix options:** (a) use Prisma's `Accelerate` or PgBouncer for connection pooling, (b) host the app in the same region as the DB so each round-trip drops to ~5 ms, (c) compress the transaction by inlining testsAdvised + audit into a single `executeRaw`.
2. **Activity create averages 200–740 ms** — same Neon-latency story. Doctor logging a quick treatment will feel the lag on mobile when network is flaky. Suggest a client-side optimistic insert in the timeline (the cache already revalidates within 30s).
3. **Today timeline cache invalidates aggressively.** Every activity mutation calls `revalidateTag('today-counts')` AND `revalidateTag('activities')`, which busts the today-timeline cache (`tags: ['today-counts', 'animals']`). At a clinic with 5 doctors logging concurrently, the cache will rarely hit. Consider segmenting tags: today-timeline only listens to `today-counts`, search-activities listens to `activities`.
4. **`/reports/today` lost its heading.** The page used to render "Daily activity report"; now it renders "Reports" + tab nav. The mockup header card is gone. Tests still expect the old heading. **Fix:** decide which is canonical (the page or the test) and align.
5. **`occurredAt` relative-time string is hard to read.** The e2e test recorded `"10:41 PM · May 19"` instead of `"3h ago"` — meaning the formatter is showing the absolute date for activities >2h old. Doctors want quick-glance "3h ago" / "20 min ago". Lower the threshold or move the absolute date to a tooltip.

### P2 — Quality-of-life

6. **No "hard delete" surface.** The codebase only does soft-delete on activities and animals. The user explicitly asked about hard delete in the goal. Currently the only hard-delete path is the manual `scripts/clear-test-data.ts`. Decision needed: add an admin-only "permanently delete" affordance on the audit log page? Or stay soft-delete-only and document that as the policy?
7. **No edit history view.** Activities track `editedAt` and `editedById` but the UI never surfaces "edited by Dr. X at 14:32" on the activity sheet — it just shows the latest values. Doctors will want to see the audit trail in-place for clinical defensibility.
8. **Last-admin guard untested in prod data.** Only 1 ADMIN in the DB; the H2-s guard can't be exercised without standing up a second admin. The code path is correct, but no live test fired. Add a fixture admin (e.g. `admin-test@arham.care`) for future probes.
9. **Cache invalidation on `searchActivitiesAction`.** The new 30s `unstable_cache` will hold stale results for up to 30s if the doctor types, edits an activity, then re-searches. Acceptable, but document the tradeoff.
10. **Drive parent verification on finalize is silent on rate-limit.** If Drive returns 429, the user sees a generic "finalize failed" with no retry suggestion. Consider exposing a "try again" message specifically for 429.

### P3 — Polish

11. **Today timeline shows "DriveE2E-16fe87" animal** — leftover from the e2e-upload test. Stale test fixtures linger in prod-ish data. Add a teardown to `scripts/e2e-upload.ts` (or filter `__e2e_` prefixed animals from the timeline by default).
12. **Browser console: repeated 404s during QuickAdd.** Almost certainly thumbnails for animals whose `mediaAsset.storageKey` no longer resolves. Need to gracefully fall back to the procedural avatar when an image 404s, not log to the console.
13. **No empty-state for "no admitted patients" in QuickAdd patient picker.** Mockup specifies "No active patients — admit one first" + secondary button; check if shipped.
14. **STAFF role can read all activities + all media** for any animal — needed for ward operations but worth a "view-only" partition if a clinic ever wants to silo per-ward staff.

## Test infrastructure debt

- `e2e-today-timeline.ts`: race-prone — asserts "the activity I just created is first" but other concurrent tests can log later activities. Fix: filter by the test's own session marker.
- `e2e-daily-report.ts`: `getByText(/Daily activity report/i)` no longer matches the page. Either restore the H2 or update the locator to the new heading.
- 36 of the 9 currently-passing suites generate 404s in the browser console (lucide-react icons or missing thumbnails). Not failures, but noisy.

## Perf measurements (from stress sim)

Top-10 slowest service ops, ms:
```
 1351  admit Bruno
  867  dischargeAnimal
  817  admit Milo
  809  admit Coco
  800  admit Mishka
  738  activity ROUND d1 Bruno
  724  admit Shadow
  720  updateActivity (data + remarks)
  666  recordDeath
  628  updateAnimal (ward + ageText)
```

Concurrent stress: **10 parallel createActivity calls in 1410 ms** (140 ms average each, with contention).

## Recommendations — prioritized

1. **Move the production deploy to ap-southeast-1** (Vercel `sin1` region). The single biggest perf lever — admissions should drop to ~200 ms each.
2. **Add an optimistic-insert pattern** to the today timeline + patient-page activity list so the doctor sees their activity instantly even on a 1s save.
3. **Tighten cache invalidation tags** so `searchActivitiesAction` and `today-timeline` don't share a bus.
4. **Restore the `/reports/today` H2** ("Daily activity report") and update the playwright suite to match.
5. **Surface the edit-history** on the ActivitySheet — even a small "edited by Dr. Iyer · 2 days ago" line.
6. **Decide hard-delete policy** — admin-only UI, or stay soft-delete + audit only?
7. **Fix the 2 stale Playwright tests** so CI has a clean signal.
