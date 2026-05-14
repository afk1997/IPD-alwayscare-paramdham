# Arham Always Care — IPD

Animal hospital In-Patient Department management. Built for floor staff, doctors, and admins.

## Stack

- **Next.js 15** (App Router, Server Components, Server Actions)
- **TypeScript** strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)
- **Postgres** local via Docker → **Neon** in production
- **Prisma** ORM
- **Auth.js v5** (credentials + JWT sessions)
- **Tailwind CSS** with CSS-variable themes (Clinical / Warm / Utility)
- **Biome** lint + format
- **Vitest** + **Playwright** for tests

## Local setup

```bash
pnpm install
docker compose up -d postgres
pnpm run db:migrate
pnpm run db:seed
pnpm run dev
```

Visit `http://localhost:3000` and sign in:

| Email                | Password    | Role   |
| -------------------- | ----------- | ------ |
| admin@arham.care     | admin1234   | ADMIN  |
| mehta@arham.care     | doctor1234  | DOCTOR |
| iyer@arham.care      | doctor1234  | DOCTOR |
| sahil@arham.care     | staff1234   | STAFF  |
| pooja@arham.care     | staff1234   | STAFF  |
| anu@arham.care       | staff1234   | STAFF  |

## Scripts

| Command              | What it does                                       |
| -------------------- | -------------------------------------------------- |
| `pnpm dev`           | Run dev server (Turbopack)                         |
| `pnpm build`         | Production build                                   |
| `pnpm typecheck`     | `tsc --noEmit`                                     |
| `pnpm lint`          | Biome lint                                         |
| `pnpm format`        | Biome format                                       |
| `pnpm test`          | Vitest unit tests                                  |
| `pnpm test:e2e`      | Playwright e2e tests (desktop + mobile projects)   |
| `pnpm db:up` / `db:down` | Start / stop Postgres container                |
| `pnpm db:migrate`    | Apply pending migrations                           |
| `pnpm db:seed`       | Seed 6 default users                               |
| `pnpm db:studio`     | Open Prisma Studio                                 |

## Architecture

- **Feature-sliced** `src/features/{animals,activities,documents,reports,auth,users,audit,settings}/` — each owns its `schema`, `service`, `queries`, `actions`, `components`, `__tests__`.
- **`src/app/`** routes are thin: fetch data → render one feature component.
- **`src/lib/`** holds cross-cutting infra: `prisma`, `auth`, `rbac`, `audit`, `storage`, `time`, `errors`.
- **Service layer** is the only writer to Prisma. Every mutation calls `writeAuditLog(tx, ...)` inside the same transaction so the audit trail is non-bypassable.
- **RBAC** lives in `lib/rbac.ts` and is enforced by each service (`assertCan(actor, action)`).
- **Storage** is behind the `FileStorage` interface — `LocalDiskStorage` in dev, `GoogleDriveStorage` (with service-account auth + p-retry backoff) in prod. Switch via `STORAGE_DRIVER` env var. The download proxy `/api/files/[id]` always auths the request before streaming — Drive direct URLs are never exposed.
- **Caching**: `unstable_cache` with tag-based invalidation. Mutations call `revalidateTag` for the data they affect.

## Production cutover (when ready)

```bash
# 1. Database (Neon)
export DATABASE_URL='postgres://...neon.tech:5432/...?sslmode=require&pgbouncer=true&connection_limit=10'
pnpm exec prisma migrate deploy
pnpm exec dotenv -e .env.production.local -- tsx prisma/seed.ts   # admin only

# 2. Google Drive
export STORAGE_DRIVER=gdrive
export GOOGLE_SERVICE_ACCOUNT_JSON="$(base64 < service-account.json)"
export GOOGLE_DRIVE_ROOT_FOLDER_ID='<folder-id where the service account has Editor>'

# 3. App secrets
export AUTH_SECRET="$(openssl rand -base64 32)"
export AUTH_URL='https://your-domain.example'

# 4. Deploy (Vercel, Fly.io, etc.)
```

## Code organization rules

1. One concept per file
2. Pages are dumb (data-fetch + render one feature component)
3. No `prisma` import outside `features/*/{service,queries}.ts`
4. Co-locate by feature, not by kind
5. No barrel exports
6. Strict TS — no `any` (except discriminated-union form layer with explicit `// biome-ignore`)

## Roadmap

See `docs/superpowers/specs/2026-05-15-arham-ipd-design.md` for the full spec and phase plan.
