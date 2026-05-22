# Pre-launch deep review + Trash feature — Design Spec

**Date:** 2026-05-22
**Status:** Approved — proceeding to execution
**Owner:** kaivan@techseva.info

---

## 1. Context

The IPD app is functionally complete. Before pushing to Vercel and handing over for real clinic use, we want a final exhaustive bug hunt and security review across the entire app, plus fix the broken "restore deleted things" flow.

The current UI tells users they can restore deleted items from the audit log. The audit log page is read-only — there is no restore action anywhere. Documents have no restore function at all. Animals have neither delete nor restore functions in code, despite the schema and RBAC permission existing.

## 2. Goals & non-goals

**Goals**
- Find every bug and security issue currently in this branch.
- Fix all of them in this session, in severity order, so the app is shippable.
- Restore the broken delete/restore promise with a dedicated Trash page.
- Verify with e2e + manual flows before declaring done.
- Confirm Vercel deploy readiness (env, region, headers, secrets, runtime).

**Non-goals**
- New features beyond Trash.
- Multi-tenant / multi-clinic.
- Chasing Neon WAN latency to <100ms — environmental, mitigated not eliminated.

## 3. Approach (committed)

Parallel discovery → triage → build Trash → fix-all → e2e regression → deploy gate.

## 4. Discovery pass — surface map

Specialist sub-agents run in parallel, each on a tight surface, returning a findings list:

| Slice | Surface |
|---|---|
| Auth & sessions | `src/lib/auth.ts`, `src/middleware.ts`, `src/features/auth/*`, Auth.js callbacks, JWT shape, throttling, password params, session expiry, CSRF posture |
| RBAC enforcement | `src/lib/rbac.ts`, every `assertCan` call site, action-vs-role matrix completeness |
| Server actions | All `actions.ts` files: input validation, error-leak paths, return shapes, `'use server'` correctness |
| API routes / file proxy | `/api/files/initiate`, `/finalize`, `/[id]`, asset ownership, mime sniffing, response headers, streaming |
| Soft-delete + audit integrity | Every entity with `deletedAt`, every mutation writes `writeAuditLog`, transaction atomicity, queries filter deleted, restore semantics |
| Prisma + DB | `schema.prisma`, migrations, cascades, indexes, decimal precision, enum coverage, race conditions |
| Storage / Drive | `lib/storage/*`, service-account scope, `folderResolver` advisory locks, p-retry, secrets handling |
| UI/UX bugs | Forms, a11y on critical flows, focus traps, toast lifetimes, mobile nav, lightbox, empty states |
| Deploy/Vercel readiness | `next.config.ts`, env inventory vs `.env.example`, security headers, function regions, Neon pooling, runtime version, build pipeline |
| Test suite integrity | Vitest + Playwright config, e2e scripts, stale tests, dead fixtures |

Each agent returns under 1000 words: severity (Critical/High/Medium/Low/Info), file:line, what's wrong, why it matters, suggested fix.

## 5. Triage rules

- **Critical** — data loss, auth bypass, unauthenticated PHI read, RCE, IDOR on medical record, broken core flow.
- **High** — privilege escalation, secret leak, soft-delete inconsistency that loses data, missing audit on mutation, broken restore.
- **Medium** — UX papercut on a daily flow, perf regression on hot path, stale fixture, console spam.
- **Low/Info** — cosmetic, dead code, doc drift.

Dedupe against `docs/stress-test-report.md` and the H1-s–H9-s already-fixed history.

## 6. Trash feature design

**Data model:** no new tables. Uses existing `deletedAt` on `Animal`, `Activity`, `Document`. Nothing added to `AuditLog`.

**New code:**
- `src/features/animals/service.ts`: add `softDeleteAnimal(actor, animalId)` and `restoreAnimal(actor, animalId)`. Both write `writeAuditLog` inside the transaction. RBAC: `animal.delete` (ADMIN-only, already declared).
- `src/features/documents/service.ts`: add `restoreDocument(actor, documentId)`. RBAC: `document.delete` (DOCTOR + ADMIN).
- `src/features/trash/queries.ts`: `listTrash({ kind, take, skip })`. Returns soft-deleted rows with id, label, deletedBy (from most recent `delete` audit row), deletedAt, parent context.
- `src/features/trash/actions.ts`: `restoreActivityFromTrashAction`, `restoreDocumentFromTrashAction`, `restoreAnimalFromTrashAction`.
- `src/app/(app)/admin/trash/page.tsx`: admin-only route. Tabs: Activities / Documents / Animals. Table with Restore button + search + pagination (50/page).
- Sidebar nav entry under Admin → "Trash" (ADMIN-only).

**UI string fix:** replace `ActivitySheet.tsx:205` text ("…restore it from the audit log") with "…restore it from the Trash page". Apply the same string everywhere delete confirmation appears.

**RBAC:** Trash page itself requires `audit.read.all` (ADMIN). Per-row restore checks the entity-specific gate.

**Restore semantics:**
- Activity: `deletedAt = null`, audit row `action: 'restore'`, bust `today-timeline` + `activities` tags.
- Document: same pattern.
- Animal: `deletedAt = null`. Status preserved. Child activities/documents reappear naturally because their queries filter by animal `deletedAt`.

**Edge cases:**
- Already-restored entity — idempotent no-op.
- Restoring discharged/deceased animal — returns to patient list with whatever last status.
- Pagination — 50/page.
- Delete-after-restore — works (new `deletedAt` timestamp).

## 7. Fix workflow

1. Consolidate all subagent findings into a single ranked list (`docs/superpowers/specs/2026-05-22-findings.md`).
2. Build the Trash feature first (highest-leverage, user-flagged item).
3. Walk the findings list top-down, fixing each. After each Critical/High fix, run the relevant existing test or write a new probe.
4. After every batch (~5 fixes), run typecheck + lint + unit tests.

## 8. E2E coverage plan

- Run all existing `scripts/qa-*` and `scripts/e2e-*` probes against the local dev server.
- Add new probes:
  - `qa-trash-page.ts` — admin opens Trash, restores an activity, restores a document, restores an animal.
  - `qa-restore-rbac.ts` — STAFF user redirected from `/admin/trash`; DOCTOR redirected from `/admin/trash`.
  - `qa-soft-delete-consistency.ts` — soft-deleted entities disappear from list views and reports.
- Update the two stale Playwright tests called out in the stress report.

## 9. Vercel deploy-readiness gate

- `.env.example` covers every var the app reads at runtime; no missing keys.
- `AUTH_SECRET` is required (and the error message is clear if missing).
- `next.config.ts` sets security headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, CSP for app pages).
- Region: function region in same continent as Neon DB (ap-southeast-1 → `bom1`/`sin1`).
- Node runtime: 20+ (matches Vercel default in 2026).
- `prisma generate` in postinstall — confirmed.
- Connection pooling enabled (`?pgbouncer=true&connection_limit=10` documented in README).
- Build does not include `prisma migrate deploy` automatically — kept manual to avoid surprise migrations.
- No `.env.local` shipped (in `.gitignore` — confirmed).
- Google service-account JSON never logged.
- Sensible response cache headers on file proxy (already `private, max-age=86400`).
- Login route does not leak which field failed (email vs password).

## 10. Risks & cutoffs

- **Time risk:** "fix everything" across full app may surface 30+ findings. If the discovery pass returns >40 findings, we'll batch by severity and document any deferred Low/Info items in `docs/superpowers/specs/2026-05-22-findings.md` for the user to confirm shipping with.
- **Test infra:** existing e2e scripts depend on local Docker Postgres; we will not refactor them, only run them and write new ones in the same style.
- **Breaking changes:** the Trash feature renames the in-app hint string and adds a new admin route. No data migration is needed.

## 11. Done definition

- All Critical + High findings fixed and verified.
- All Medium findings fixed unless explicitly deferred.
- Trash page functional with Restore working for Activity, Document, Animal.
- `pnpm typecheck`, `pnpm lint`, `pnpm test` all green.
- The new `qa-trash-*` Playwright probes pass.
- The previously-stale Playwright probes pass.
- Vercel deploy-readiness checklist all green.
- Summary report written with: findings + fixes table, what was deferred (if any), Vercel deploy steps.
