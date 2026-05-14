# Phase 0 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap a Next.js + Postgres + Prisma + Auth.js + Tailwind project with the responsive AppShell, three theme variants, a working login → home flow, and seeded dev data.

**Architecture:** Single Next.js 15 app (App Router, React Server Components). Local Postgres in Docker. Prisma migrations. Auth.js v5 with credentials provider + DB sessions. Tailwind with CSS variables driving three themes via `data-theme` on `<html>`. Feature-sliced source folders under `src/`. Biome for lint + format. Vitest for unit tests, Playwright for e2e.

**Tech Stack:** Next.js 15, TypeScript (strict), Tailwind CSS, Prisma + Postgres 16, Auth.js v5, Zod, React Hook Form, Lucide icons, bcryptjs, Biome, Vitest, Playwright.

---

## Pre-flight context

- **Working dir:** `/Users/kaivan108icloud.com/Documents/new ipd/` (currently empty except `designs/` and `docs/`)
- **Not a git repo yet** — Task 0 initializes one
- **Spec:** `docs/superpowers/specs/2026-05-15-arham-ipd-design.md` — read §3 (data model), §4 (RBAC), §7 (caching), §8 (themes), §9 (code organization) before starting
- **Designs:** `designs/source/project/` — source HTML/JSX prototype. Reference `web-shell.jsx`, `shell.jsx`, `Brand Guidelines.html` for visuals. Do NOT copy the prototype's file structure — match the visual output using our feature-sliced layout

---

## File structure (Phase 0)

```
/
├── .env.local                              # local DATABASE_URL, AUTH_SECRET, etc.
├── .env.example                            # template (committed)
├── .gitignore
├── biome.json                              # lint + format config
├── docker-compose.yml                      # local Postgres
├── next.config.ts
├── package.json
├── playwright.config.ts
├── postcss.config.mjs
├── tailwind.config.ts
├── tsconfig.json
├── vitest.config.ts
├── prisma/
│   ├── schema.prisma                       # User + Auth.js tables only in P0
│   ├── seed.ts                             # creates admin user, 3 sample users
│   └── migrations/                         # generated
├── public/
│   └── favicon.ico
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   └── login/page.tsx              # <LoginForm/>
│   │   ├── (app)/
│   │   │   ├── layout.tsx                  # <AppShell/>
│   │   │   └── page.tsx                    # <TodayDashboard/> (empty stats stub)
│   │   ├── api/auth/[...nextauth]/route.ts
│   │   ├── layout.tsx                      # Root layout w/ fonts + ThemeProvider
│   │   ├── globals.css                     # CSS variables for 3 themes
│   │   └── not-found.tsx
│   ├── components/
│   │   ├── shell/
│   │   │   ├── AppShell.tsx
│   │   │   ├── SideNav.tsx
│   │   │   ├── BottomNav.tsx
│   │   │   ├── TopBar.tsx
│   │   │   ├── BrandMark.tsx
│   │   │   └── useViewport.ts
│   │   └── ui/
│   │       ├── Button.tsx
│   │       ├── Chip.tsx
│   │       └── Pill.tsx
│   ├── features/
│   │   ├── auth/
│   │   │   ├── schema.ts                   # Zod login schema
│   │   │   ├── service.ts                  # verifyCredentials, hashPassword
│   │   │   ├── actions.ts                  # loginAction (server action)
│   │   │   ├── components/
│   │   │   │   └── LoginForm.tsx
│   │   │   └── __tests__/
│   │   │       └── service.test.ts
│   │   ├── reports/
│   │   │   └── components/
│   │   │       └── TodayDashboard.tsx      # stub w/ placeholder tiles
│   │   └── settings/
│   │       └── components/
│   │           └── ThemeSwitcher.tsx
│   ├── lib/
│   │   ├── prisma.ts                       # singleton client
│   │   ├── auth.ts                         # Auth.js config + getCurrentUser
│   │   ├── theme.ts                        # Theme = 'clinical'|'warm'|'utility'; cookie name
│   │   └── errors.ts                       # RbacError, ValidationError, NotFoundError
│   └── middleware.ts                       # auth-guard for (app) routes
├── tests/
│   └── e2e/
│       ├── login.spec.ts
│       └── helpers.ts
└── .github/
    └── workflows/
        └── ci.yml                          # typecheck + lint + test on PR
```

---

## Task 0: Initialize git + scaffold Next.js

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `.gitignore`

- [ ] **Step 1: Initialize git repo**

```bash
cd "/Users/kaivan108icloud.com/Documents/new ipd"
git init
git config user.email "kaivan@techseva.info"
git config user.name "Arham Always Care"
```

- [ ] **Step 2: Scaffold Next.js with TS + Tailwind + App Router**

```bash
pnpm dlx create-next-app@latest . --typescript --tailwind --app --src-dir --import-alias '@/*' --no-eslint --use-pnpm --turbopack
```
Expected: drops files into the current directory. Answer "Yes" if it prompts about non-empty directory.

- [ ] **Step 3: Verify scaffold**

```bash
ls package.json tsconfig.json next.config.ts src/app/page.tsx
pnpm install
pnpm run build
```
Expected: build succeeds with a default Next.js page.

- [ ] **Step 4: Update `.gitignore`**

Append to `.gitignore`:
```
.env*.local
uploads/
docker-data/
.next/
playwright-report/
test-results/
coverage/
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js 15 app with TypeScript + Tailwind + App Router"
```

---

## Task 1: Configure strict TypeScript + Biome

**Files:**
- Modify: `tsconfig.json`
- Create: `biome.json`, `package.json` (add scripts)

- [ ] **Step 1: Tighten `tsconfig.json`**

Replace `tsconfig.json` contents:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitOverride": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 2: Install Biome**

```bash
pnpm add -D -E @biomejs/biome@1.9.4
```

- [ ] **Step 3: Create `biome.json`**

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true },
  "files": { "ignoreUnknown": true, "ignore": [".next", "node_modules", "playwright-report", "test-results", "coverage", "prisma/migrations"] },
  "formatter": { "enabled": true, "indentStyle": "space", "indentWidth": 2, "lineWidth": 110 },
  "javascript": { "formatter": { "quoteStyle": "single", "semicolons": "always", "trailingCommas": "all" } },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "suspicious": { "noExplicitAny": "error", "noConsoleLog": "error" },
      "style": { "useImportType": "error", "useNodejsImportProtocol": "error" },
      "complexity": { "noExcessiveCognitiveComplexity": { "level": "warn", "options": { "maxAllowedComplexity": 15 } } },
      "correctness": { "noUnusedVariables": "error", "noUnusedImports": "error" }
    }
  }
}
```

- [ ] **Step 4: Add scripts to `package.json`**

In `package.json` `"scripts"`:
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "biome check src tests",
    "format": "biome format --write src tests",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "db:up": "docker compose up -d postgres",
    "db:down": "docker compose down",
    "db:migrate": "prisma migrate dev",
    "db:seed": "tsx prisma/seed.ts",
    "db:studio": "prisma studio"
  }
}
```

- [ ] **Step 5: Run lint + typecheck to baseline**

```bash
pnpm run typecheck
pnpm run lint
```
Expected: both pass on the scaffold.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: strict TypeScript + Biome with project rules"
```

---

## Task 2: Docker Compose Postgres + env files

**Files:**
- Create: `docker-compose.yml`, `.env.example`, `.env.local`

- [ ] **Step 1: Create `docker-compose.yml`**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: arham_ipd_pg
    restart: unless-stopped
    environment:
      POSTGRES_USER: arham
      POSTGRES_PASSWORD: arham_dev
      POSTGRES_DB: arham_ipd
    ports:
      - '5433:5432'
    volumes:
      - ./docker-data/pg:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U arham -d arham_ipd']
      interval: 5s
      timeout: 5s
      retries: 10
```

- [ ] **Step 2: Create `.env.example`**

```bash
# Database
DATABASE_URL="postgresql://arham:arham_dev@localhost:5433/arham_ipd?schema=public"

# Auth.js
AUTH_SECRET="generate-with-openssl-rand-base64-32"
AUTH_URL="http://localhost:3000"

# Storage
STORAGE_DRIVER="local"
LOCAL_UPLOAD_DIR="./uploads"

# Google Drive (prod only)
# GOOGLE_SERVICE_ACCOUNT_JSON=""
# GOOGLE_DRIVE_ROOT_FOLDER_ID=""

# App
NODE_ENV="development"
```

- [ ] **Step 3: Create `.env.local` (NOT committed)**

```bash
DATABASE_URL="postgresql://arham:arham_dev@localhost:5433/arham_ipd?schema=public"
AUTH_SECRET="$(openssl rand -base64 32 | tr -d '\n')"
AUTH_URL="http://localhost:3000"
STORAGE_DRIVER="local"
LOCAL_UPLOAD_DIR="./uploads"
NODE_ENV="development"
```

Run this to generate it with a real secret:
```bash
SECRET=$(openssl rand -base64 32 | tr -d '\n')
cat > .env.local <<EOF
DATABASE_URL="postgresql://arham:arham_dev@localhost:5433/arham_ipd?schema=public"
AUTH_SECRET="$SECRET"
AUTH_URL="http://localhost:3000"
STORAGE_DRIVER="local"
LOCAL_UPLOAD_DIR="./uploads"
NODE_ENV="development"
EOF
```

- [ ] **Step 4: Start Postgres + verify**

```bash
docker compose up -d postgres
docker compose ps
docker exec arham_ipd_pg pg_isready -U arham -d arham_ipd
```
Expected: container "healthy", `pg_isready` returns `accepting connections`.

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml .env.example .gitignore
git commit -m "chore: docker-compose Postgres + env templates"
```

---

## Task 3: Prisma client + User schema + first migration

**Files:**
- Create: `prisma/schema.prisma`, `src/lib/prisma.ts`

- [ ] **Step 1: Install Prisma + bcryptjs**

```bash
pnpm add @prisma/client@5.22.0 bcryptjs@2.4.3
pnpm add -D prisma@5.22.0 @types/bcryptjs@2.4.6 tsx@4.19.2
```

- [ ] **Step 2: Initialize Prisma**

```bash
pnpm prisma init --datasource-provider postgresql
```
This creates `prisma/schema.prisma` and `.env`. Delete the new `.env` (we use `.env.local`):
```bash
rm .env
```

- [ ] **Step 3: Write `prisma/schema.prisma` for Phase 0**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  STAFF
  DOCTOR
  ADMIN
}

model User {
  id              String    @id @default(cuid())
  email           String    @unique
  passwordHash    String
  name            String
  role            Role
  active          Boolean   @default(true)
  themePreference String    @default("clinical")
  invitedById     String?
  invitedAt       DateTime?
  lastLoginAt     DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  invitedBy User?  @relation("UserInvites", fields: [invitedById], references: [id])
  invitees  User[] @relation("UserInvites")
  sessions  Session[]
  accounts  Account[]

  @@index([role, active])
}

// === Auth.js standard tables ===
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}
```

- [ ] **Step 4: Load env from `.env.local` for Prisma**

Prisma reads `.env` by default, so we point it at `.env.local`. Add to `package.json`:
```json
"prisma": { "seed": "tsx prisma/seed.ts" }
```

And update the `db:migrate` and `db:seed` scripts to dotenv-load `.env.local`:
```bash
pnpm add -D dotenv-cli@7.4.4
```

Update scripts in `package.json`:
```json
"db:migrate": "dotenv -e .env.local -- prisma migrate dev",
"db:seed": "dotenv -e .env.local -- tsx prisma/seed.ts",
"db:studio": "dotenv -e .env.local -- prisma studio",
"db:push": "dotenv -e .env.local -- prisma db push"
```

- [ ] **Step 5: Create initial migration**

```bash
pnpm run db:migrate -- --name init_auth
```
Expected: creates `prisma/migrations/{ts}_init_auth/migration.sql` and applies it.

- [ ] **Step 6: Create Prisma singleton at `src/lib/prisma.ts`**

```ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

- [ ] **Step 7: Verify connection**

Create `scripts/check-db.ts`:
```ts
import { prisma } from '../src/lib/prisma';

async function main() {
  const count = await prisma.user.count();
  // biome-ignore lint/suspicious/noConsoleLog: dev script
  console.log('Connected. User count:', count);
  await prisma.$disconnect();
}

main().catch((e) => {
  // biome-ignore lint/suspicious/noConsoleLog: dev script
  console.error(e);
  process.exit(1);
});
```

```bash
pnpm dlx dotenv -e .env.local -- tsx scripts/check-db.ts
```
Expected: `Connected. User count: 0`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(db): initial Prisma schema with User + Auth.js tables"
```

---

## Task 4: Brand tokens & fonts in globals.css + Tailwind config

**Files:**
- Modify: `src/app/globals.css`
- Modify: `tailwind.config.ts`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Replace `src/app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* ============================================
   Theme tokens — three variants
   Switched by `data-theme` on <html>
   ============================================ */

:root,
[data-theme='clinical'] {
  --bg: 245 248 250;
  --paper: 255 255 255;
  --paper-2: 240 244 247;
  --line: 226 232 238;
  --text: 15 27 38;
  --muted: 91 107 122;
  --soft: 144 160 176;

  --accent: 14 124 123;
  --accent-soft: 214 238 238;
  --accent-ink: 10 93 92;
  --accent-fg: 255 255 255;

  --critical: 180 35 24;
  --critical-bg: 254 228 226;
  --stable: 6 118 71;
  --stable-bg: 220 250 230;
  --observation: 147 55 13;
  --observation-bg: 254 240 199;

  --header-bg: 255 255 255;
  --surface: 255 255 255;
  --surface-2: 240 244 247;
}

[data-theme='warm'] {
  --bg: 252 247 242;
  --paper: 255 255 255;
  --paper-2: 248 240 232;
  --line: 232 220 208;
  --text: 41 27 18;
  --muted: 122 96 78;
  --soft: 176 152 130;

  --accent: 181 71 26;
  --accent-soft: 246 226 210;
  --accent-ink: 122 47 17;
  --accent-fg: 255 255 255;

  --critical: 180 35 24;
  --critical-bg: 254 228 226;
  --stable: 6 118 71;
  --stable-bg: 220 250 230;
  --observation: 147 55 13;
  --observation-bg: 254 240 199;

  --header-bg: 255 255 255;
  --surface: 255 255 255;
  --surface-2: 248 240 232;
}

[data-theme='utility'] {
  --bg: 11 15 20;
  --paper: 22 28 36;
  --paper-2: 30 38 48;
  --line: 46 56 70;
  --text: 232 238 246;
  --muted: 153 166 183;
  --soft: 110 124 142;

  --accent: 91 228 155;
  --accent-soft: 26 50 41;
  --accent-ink: 200 246 220;
  --accent-fg: 11 15 20;

  --critical: 248 113 113;
  --critical-bg: 60 28 28;
  --stable: 134 239 172;
  --stable-bg: 22 50 36;
  --observation: 251 191 36;
  --observation-bg: 50 38 12;

  --header-bg: 22 28 36;
  --surface: 22 28 36;
  --surface-2: 30 38 48;
}

html,
body {
  background: rgb(var(--bg));
  color: rgb(var(--text));
  -webkit-font-smoothing: antialiased;
}

* {
  box-sizing: border-box;
}

/* density toggle */
[data-density='compact'] {
  --space-y: 0.5rem;
}

[data-density='comfortable'] {
  --space-y: 0.75rem;
}

@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
@keyframes slideInLeft { from { transform: translateX(-100%) } to { transform: translateX(0) } }
@keyframes slideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
```

- [ ] **Step 2: Update `tailwind.config.ts`**

```ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--bg) / <alpha-value>)',
        paper: 'rgb(var(--paper) / <alpha-value>)',
        'paper-2': 'rgb(var(--paper-2) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        text: 'rgb(var(--text) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        soft: 'rgb(var(--soft) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
        'accent-soft': 'rgb(var(--accent-soft) / <alpha-value>)',
        'accent-ink': 'rgb(var(--accent-ink) / <alpha-value>)',
        'accent-fg': 'rgb(var(--accent-fg) / <alpha-value>)',
        critical: 'rgb(var(--critical) / <alpha-value>)',
        'critical-bg': 'rgb(var(--critical-bg) / <alpha-value>)',
        stable: 'rgb(var(--stable) / <alpha-value>)',
        'stable-bg': 'rgb(var(--stable-bg) / <alpha-value>)',
        observation: 'rgb(var(--observation) / <alpha-value>)',
        'observation-bg': 'rgb(var(--observation-bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        'surface-2': 'rgb(var(--surface-2) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-jakarta)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        lg: '14px',
        md: '10px',
        sm: '8px',
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 3: Replace `src/app/layout.tsx`**

```tsx
import type { Metadata } from 'next';
import { Inter, JetBrains_Mono, Plus_Jakarta_Sans } from 'next/font/google';
import { cookies } from 'next/headers';
import { getThemeFromCookie } from '@/lib/theme';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });

export const metadata: Metadata = {
  title: 'Arham Always Care — IPD',
  description: 'Animal IPD management',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = getThemeFromCookie(await cookies());
  return (
    <html
      lang="en"
      data-theme={theme}
      className={`${inter.variable} ${jakarta.variable} ${mono.variable}`}
    >
      <body className="font-sans">{children}</body>
    </html>
  );
}
```

- [ ] **Step 4: Create `src/lib/theme.ts`**

```ts
import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';

export const THEMES = ['clinical', 'warm', 'utility'] as const;
export type Theme = (typeof THEMES)[number];

export const DEFAULT_THEME: Theme = 'clinical';
export const THEME_COOKIE = 'arham_theme';

export function getThemeFromCookie(cookies: ReadonlyRequestCookies): Theme {
  const value = cookies.get(THEME_COOKIE)?.value;
  return THEMES.includes(value as Theme) ? (value as Theme) : DEFAULT_THEME;
}
```

- [ ] **Step 5: Verify build still passes**

```bash
pnpm run typecheck
pnpm run build
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(theme): three CSS-var themes (clinical/warm/utility) + Tailwind tokens + fonts"
```

---

## Task 5: Shared UI primitives (Button, Chip, Pill)

**Files:**
- Create: `src/components/ui/Button.tsx`, `Chip.tsx`, `Pill.tsx`
- Create: `src/components/ui/__tests__/Button.test.tsx`

- [ ] **Step 1: Install testing libs**

```bash
pnpm add -D vitest@2.1.5 @vitest/ui@2.1.5 @testing-library/react@16.0.1 @testing-library/jest-dom@6.6.3 jsdom@25.0.1 @types/react@18.3.12 @types/react-dom@18.3.1
```

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    coverage: { reporter: ['text', 'html'] },
  },
  resolve: {
    alias: { '@': resolve(__dirname, './src') },
  },
});
```

```bash
pnpm add -D @vitejs/plugin-react@4.3.3
```

- [ ] **Step 3: Create `tests/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 4: Write `Button.test.tsx`**

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../Button';

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('calls onClick', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('applies variant class', () => {
    render(<Button variant="ghost">Save</Button>);
    expect(screen.getByRole('button')).toHaveClass('border-line');
  });

  it('disables when disabled prop set', () => {
    render(<Button disabled>Save</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
```

```bash
pnpm add -D @testing-library/user-event@14.5.2
```

- [ ] **Step 5: Run test (expect fail)**

```bash
pnpm run test src/components/ui/__tests__/Button.test.tsx
```
Expected: FAIL — module not found.

- [ ] **Step 6: Implement `src/components/ui/Button.tsx`**

```tsx
import { type ButtonHTMLAttributes, forwardRef } from 'react';

type Variant = 'primary' | 'soft' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg hover:opacity-90',
  soft: 'bg-accent-soft text-accent-ink hover:opacity-90',
  ghost: 'bg-transparent border border-line text-text hover:bg-surface-2',
  danger: 'bg-critical text-white hover:opacity-90',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', className = '', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center gap-2 rounded-md font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    />
  );
});
```

- [ ] **Step 7: Run test (expect pass)**

```bash
pnpm run test src/components/ui/__tests__/Button.test.tsx
```
Expected: 4 tests pass.

- [ ] **Step 8: Implement `Chip.tsx` and `Pill.tsx`**

`src/components/ui/Chip.tsx`:
```tsx
import type { HTMLAttributes } from 'react';

interface Props extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'accent';
}

export function Chip({ variant = 'default', className = '', ...rest }: Props) {
  const cls = variant === 'accent' ? 'bg-accent-soft text-accent-ink' : 'bg-paper-2 text-text';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${cls} ${className}`}
      {...rest}
    />
  );
}
```

`src/components/ui/Pill.tsx`:
```tsx
import type { HTMLAttributes } from 'react';

type Status = 'critical' | 'stable' | 'observation' | 'neutral';

const styles: Record<Status, string> = {
  critical: 'bg-critical-bg text-critical',
  stable: 'bg-stable-bg text-stable',
  observation: 'bg-observation-bg text-observation',
  neutral: 'bg-paper-2 text-muted',
};

interface Props extends HTMLAttributes<HTMLSpanElement> {
  status: Status;
}

export function Pill({ status, className = '', children, ...rest }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${styles[status]} ${className}`}
      {...rest}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}
```

- [ ] **Step 9: Run all tests + typecheck + lint**

```bash
pnpm run test
pnpm run typecheck
pnpm run lint
```

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(ui): Button, Chip, Pill primitives with tests"
```

---

## Task 6: AppShell + responsive nav (SideNav, BottomNav, TopBar, BrandMark, useViewport)

**Files:**
- Create: `src/components/shell/{BrandMark,SideNav,BottomNav,TopBar,AppShell,useViewport}.tsx` + matching `.ts` for the hook
- Create: `src/components/shell/__tests__/useViewport.test.ts`

- [ ] **Step 1: Create `useViewport.ts`**

```ts
'use client';
import { useEffect, useState } from 'react';

const MOBILE_BREAKPOINT = 760;

export function useViewport() {
  const [width, setWidth] = useState<number>(() =>
    typeof window === 'undefined' ? 1024 : window.innerWidth,
  );
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return { width, narrow: width < MOBILE_BREAKPOINT };
}
```

- [ ] **Step 2: Create `BrandMark.tsx`**

```tsx
interface Props {
  size?: number;
  className?: string;
}

export function BrandMark({ size = 28, className = '' }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 88 88"
      aria-label="Arham Always Care"
      className={className}
    >
      <rect width="88" height="88" rx="20" className="fill-accent" />
      <circle cx="32" cy="42" r="6" className="fill-accent-fg" />
      <circle cx="44" cy="36" r="6" className="fill-accent-fg" />
      <circle cx="56" cy="42" r="6" className="fill-accent-fg" />
      <circle cx="38" cy="50" r="5" className="fill-accent-fg" />
      <circle cx="50" cy="50" r="5" className="fill-accent-fg" />
      <path
        d="M34 60 C34 54 38 50 44 50 C50 50 54 54 54 60 C54 66 50 70 44 70 C38 70 34 66 34 60 Z"
        className="fill-accent-fg"
      />
    </svg>
  );
}
```

- [ ] **Step 3: Create `SideNav.tsx`**

```tsx
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarRange, FileText, Home, PawPrint, Plus, Users } from 'lucide-react';
import { BrandMark } from './BrandMark';

const nav = [
  { href: '/', label: 'Today', icon: Home },
  { href: '/patients', label: 'Patients', icon: PawPrint },
  { href: '/reports', label: 'Reports', icon: CalendarRange },
  { href: '/documents', label: 'Documents', icon: FileText },
];

const adminNav = [{ href: '/admin/users', label: 'Users', icon: Users }];

interface Props {
  isAdmin: boolean;
  user: { name: string; role: string };
}

export function SideNav({ isAdmin, user }: Props) {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 flex h-screen w-[232px] shrink-0 flex-col border-r border-line bg-surface">
      <div className="flex items-center gap-2.5 px-4 pb-6 pt-5">
        <BrandMark size={30} />
        <div className="flex flex-col leading-tight">
          <span className="font-display text-[15px] font-extrabold tracking-tight">Arham</span>
          <span className="mt-0.5 text-[11px] font-medium text-muted">Always Care · IPD</span>
        </div>
      </div>

      <Link
        href="/activity/new"
        className="mx-3.5 mb-4 flex items-center justify-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-fg shadow-sm transition hover:opacity-90"
      >
        <Plus size={16} strokeWidth={2.4} />
        New entry
      </Link>

      <nav className="flex flex-1 flex-col gap-0.5 px-2.5">
        <div className="px-3 pb-2 pt-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-soft">
          Workspace
        </div>
        {nav.map((it) => {
          const Icon = it.icon;
          const isActive = pathname === it.href;
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ${
                isActive
                  ? 'bg-accent-soft font-semibold text-accent-ink'
                  : 'font-medium text-text hover:bg-paper-2'
              }`}
            >
              <Icon size={17} strokeWidth={isActive ? 2.2 : 1.8} />
              <span className="flex-1">{it.label}</span>
            </Link>
          );
        })}

        {isAdmin && (
          <>
            <div className="px-3 pb-2 pt-4 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-soft">
              Admin
            </div>
            {adminNav.map((it) => {
              const Icon = it.icon;
              const isActive = pathname.startsWith(it.href);
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ${
                    isActive
                      ? 'bg-accent-soft font-semibold text-accent-ink'
                      : 'font-medium text-text hover:bg-paper-2'
                  }`}
                >
                  <Icon size={17} strokeWidth={isActive ? 2.2 : 1.8} />
                  <span className="flex-1">{it.label}</span>
                </Link>
              );
            })}
          </>
        )}
      </nav>

      <div className="m-3 flex items-center gap-2.5 rounded-md border border-line bg-surface-2 p-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-soft text-xs font-bold text-accent-ink">
          {user.name
            .split(' ')
            .map((s) => s[0])
            .slice(0, 2)
            .join('')}
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-[12.5px] font-semibold">{user.name}</div>
          <div className="mt-px text-[11px] text-muted">{user.role}</div>
        </div>
      </div>
    </aside>
  );
}
```

```bash
pnpm add lucide-react@0.460.0
```

- [ ] **Step 4: Create `BottomNav.tsx`**

```tsx
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarRange, FileText, Home, PawPrint, Plus } from 'lucide-react';

const nav = [
  { href: '/', label: 'Today', icon: Home },
  { href: '/patients', label: 'Patients', icon: PawPrint },
  { href: '/activity/new', label: 'Add', icon: Plus, primary: true },
  { href: '/reports', label: 'Reports', icon: CalendarRange },
  { href: '/documents', label: 'Docs', icon: FileText },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 flex h-[64px] items-stretch border-t border-line bg-paper md:hidden">
      {nav.map((it) => {
        const Icon = it.icon;
        const isActive = it.href === '/' ? pathname === '/' : pathname.startsWith(it.href);
        if (it.primary) {
          return (
            <Link
              key={it.href}
              href={it.href}
              className="-translate-y-2.5 mx-2 my-auto flex h-12 w-12 items-center justify-center self-center rounded-full bg-accent text-accent-fg shadow-md"
              aria-label={it.label}
            >
              <Icon size={22} strokeWidth={2.4} />
            </Link>
          );
        }
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
              isActive ? 'text-accent' : 'text-muted'
            }`}
          >
            <Icon size={20} />
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 5: Create `TopBar.tsx`**

```tsx
'use client';
import { Bell, Menu, Search } from 'lucide-react';
import { BrandMark } from './BrandMark';

interface Props {
  narrow: boolean;
  title?: string;
  onMenuClick?: () => void;
}

export function TopBar({ narrow, title, onMenuClick }: Props) {
  return (
    <header
      className={`sticky top-0 z-20 flex shrink-0 items-center gap-2 border-b border-line bg-paper ${
        narrow ? 'h-[52px] px-3.5' : 'h-[56px] px-6'
      }`}
    >
      {narrow && (
        <>
          <button
            type="button"
            onClick={onMenuClick}
            aria-label="Menu"
            className="flex h-9 w-9 items-center justify-center rounded-md text-text"
          >
            <Menu size={18} />
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <BrandMark size={22} />
            <span className="truncate font-display text-sm font-bold tracking-tight">
              {title ?? 'Arham'}
            </span>
          </div>
        </>
      )}

      {!narrow && (
        <>
          <div className="flex flex-1 items-center gap-2">
            <span className="font-display text-sm font-semibold">{title ?? 'Today'}</span>
          </div>
          <div className="flex w-80 items-center gap-2 rounded-md border border-line bg-surface-2 px-3 py-1.5">
            <Search size={14} className="text-soft" />
            <input
              placeholder="Search patients, activities…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-soft"
            />
            <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[10px] text-soft">
              ⌘K
            </kbd>
          </div>
        </>
      )}

      <button
        type="button"
        className="relative flex h-9 w-9 items-center justify-center rounded-md border border-line bg-surface text-muted"
        aria-label="Notifications"
      >
        <Bell size={16} />
        <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-critical" />
      </button>
    </header>
  );
}
```

- [ ] **Step 6: Create `AppShell.tsx`**

```tsx
'use client';
import { useState } from 'react';
import { BottomNav } from './BottomNav';
import { SideNav } from './SideNav';
import { TopBar } from './TopBar';
import { useViewport } from './useViewport';

interface Props {
  user: { name: string; role: string; isAdmin: boolean };
  title?: string;
  children: React.ReactNode;
}

export function AppShell({ user, title, children }: Props) {
  const { narrow } = useViewport();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-bg text-text">
      {!narrow && <SideNav isAdmin={user.isAdmin} user={user} />}

      {narrow && drawerOpen && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setDrawerOpen(false)}
          className="fixed inset-0 z-40 bg-black/45"
          style={{ animation: 'fadeIn 0.15s ease-out' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            role="dialog"
            style={{ animation: 'slideInLeft 0.22s ease-out' }}
            className="h-full w-[260px] max-w-[85vw]"
          >
            <SideNav isAdmin={user.isAdmin} user={user} />
          </div>
        </button>
      )}

      <main className="flex h-screen min-w-0 flex-1 flex-col">
        <TopBar narrow={narrow} title={title} onMenuClick={() => setDrawerOpen(true)} />
        <div className={`flex-1 overflow-auto ${narrow ? 'pb-20' : ''}`}>
          <div className="mx-auto max-w-[1040px] px-4 py-6 md:px-7">{children}</div>
        </div>
        {narrow && <BottomNav />}
      </main>
    </div>
  );
}
```

- [ ] **Step 7: Run typecheck + lint**

```bash
pnpm run typecheck
pnpm run lint
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(shell): responsive AppShell w/ SideNav, BottomNav, TopBar, BrandMark"
```

---

## Task 7: ThemeProvider + ThemeSwitcher

**Files:**
- Create: `src/features/settings/components/ThemeSwitcher.tsx`
- Create: `src/features/settings/actions.ts`

- [ ] **Step 1: Create `src/features/settings/actions.ts`**

```ts
'use server';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { THEMES, THEME_COOKIE, type Theme } from '@/lib/theme';

export async function setThemeAction(theme: Theme): Promise<void> {
  if (!THEMES.includes(theme)) throw new Error('Invalid theme');
  const c = await cookies();
  c.set(THEME_COOKIE, theme, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    httpOnly: false,
  });
  revalidatePath('/', 'layout');
}
```

- [ ] **Step 2: Create `ThemeSwitcher.tsx`**

```tsx
'use client';
import { Moon, Palette, Sun } from 'lucide-react';
import { useTransition } from 'react';
import { type Theme, THEMES } from '@/lib/theme';
import { setThemeAction } from '../actions';

const labels: Record<Theme, string> = {
  clinical: 'Clinical',
  warm: 'Warm',
  utility: 'Utility',
};

const icons: Record<Theme, React.ComponentType<{ size?: number }>> = {
  clinical: Palette,
  warm: Sun,
  utility: Moon,
};

interface Props {
  current: Theme;
}

export function ThemeSwitcher({ current }: Props) {
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-line bg-paper p-1">
      {THEMES.map((t) => {
        const Icon = icons[t];
        const isActive = t === current;
        return (
          <button
            key={t}
            type="button"
            disabled={pending}
            onClick={() => start(() => setThemeAction(t))}
            className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition ${
              isActive ? 'bg-accent-soft text-accent-ink' : 'text-muted hover:bg-paper-2'
            }`}
          >
            <Icon size={14} />
            {labels[t]}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Run typecheck**

```bash
pnpm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(settings): ThemeSwitcher with cookie-backed server action"
```

---

## Task 8: Auth.js v5 setup (credentials + DB session)

**Files:**
- Create: `src/lib/auth.ts`, `src/features/auth/{schema,service}.ts`, `src/app/api/auth/[...nextauth]/route.ts`, `src/middleware.ts`
- Create: `src/features/auth/__tests__/service.test.ts`

- [ ] **Step 1: Install Auth.js**

```bash
pnpm add next-auth@5.0.0-beta.25 @auth/prisma-adapter@2.7.4
```

- [ ] **Step 2: Create `src/features/auth/schema.ts`**

```ts
import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'At least 8 characters'),
});

export type LoginInput = z.infer<typeof LoginSchema>;
```

```bash
pnpm add zod@3.23.8
```

- [ ] **Step 3: Write `service.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../service';

describe('password hashing', () => {
  it('hashPassword produces a non-empty hash different from the input', async () => {
    const hash = await hashPassword('s3cret_PA55!');
    expect(hash.length).toBeGreaterThan(20);
    expect(hash).not.toBe('s3cret_PA55!');
  });

  it('verifyPassword returns true for correct password', async () => {
    const hash = await hashPassword('s3cret_PA55!');
    await expect(verifyPassword('s3cret_PA55!', hash)).resolves.toBe(true);
  });

  it('verifyPassword returns false for wrong password', async () => {
    const hash = await hashPassword('s3cret_PA55!');
    await expect(verifyPassword('wrong', hash)).resolves.toBe(false);
  });
});
```

- [ ] **Step 4: Run test (expect fail)**

```bash
pnpm run test src/features/auth/__tests__/service.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 5: Implement `src/features/auth/service.ts`**

```ts
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

const BCRYPT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email: email.toLowerCase() } });
}

export async function verifyCredentials(email: string, password: string) {
  const user = await findUserByEmail(email);
  if (!user || !user.active) return null;
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return null;
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}
```

- [ ] **Step 6: Run tests (expect pass)**

```bash
pnpm run test src/features/auth/__tests__/service.test.ts
```

- [ ] **Step 7: Create `src/lib/auth.ts`**

```ts
import { PrismaAdapter } from '@auth/prisma-adapter';
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { LoginSchema } from '@/features/auth/schema';
import { verifyCredentials } from '@/features/auth/service';
import { prisma } from './prisma';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt', maxAge: 60 * 60 * 8 },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      async authorize(raw) {
        const parsed = LoginSchema.safeParse(raw);
        if (!parsed.success) return null;
        return verifyCredentials(parsed.data.email, parsed.data.password);
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: string }).role;
      }
      return token;
    },
    session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
  },
});

export async function getCurrentUser() {
  const session = await auth();
  return session?.user
    ? {
        id: session.user.id as string,
        email: session.user.email ?? '',
        name: session.user.name ?? '',
        role: (session.user as { role?: string }).role ?? 'STAFF',
      }
    : null;
}
```

- [ ] **Step 8: Create `src/app/api/auth/[...nextauth]/route.ts`**

```ts
export { GET, POST } from '@/lib/auth';
```

Wait — Auth.js v5 exports `handlers`, so:

```ts
import { handlers } from '@/lib/auth';
export const { GET, POST } = handlers;
```

- [ ] **Step 9: Create `src/middleware.ts`**

```ts
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isAuthPage = req.nextUrl.pathname.startsWith('/login');

  if (!isLoggedIn && !isAuthPage) {
    const loginUrl = new URL('/login', req.nextUrl.origin);
    loginUrl.searchParams.set('next', req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL('/', req.nextUrl.origin));
  }
});

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico)$).*)'],
};
```

- [ ] **Step 10: Add type augmentation `src/types/auth.d.ts`**

```ts
import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: { id: string; role: string } & DefaultSession['user'];
  }
  interface User {
    role: string;
  }
}
declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    role?: string;
  }
}
```

Add to `tsconfig.json` `include`:
```json
"include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", "src/types/**/*.d.ts", ".next/types/**/*.ts"],
```

- [ ] **Step 11: Run typecheck**

```bash
pnpm run typecheck
```

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat(auth): Auth.js v5 credentials provider + middleware + password service"
```

---

## Task 9: Login page + LoginForm

**Files:**
- Create: `src/features/auth/components/LoginForm.tsx`
- Create: `src/features/auth/actions.ts`
- Create: `src/app/(auth)/login/page.tsx`

- [ ] **Step 1: Install React Hook Form + resolvers**

```bash
pnpm add react-hook-form@7.53.2 @hookform/resolvers@3.9.1
```

- [ ] **Step 2: Create `src/features/auth/actions.ts`**

```ts
'use server';
import { AuthError } from 'next-auth';
import { signIn } from '@/lib/auth';
import { LoginSchema } from './schema';

export interface LoginActionResult {
  ok: boolean;
  error?: string;
}

export async function loginAction(formData: FormData): Promise<LoginActionResult> {
  const parsed = LoginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  try {
    await signIn('credentials', { ...parsed.data, redirect: false });
    return { ok: true };
  } catch (e) {
    if (e instanceof AuthError) {
      return { ok: false, error: 'Invalid email or password' };
    }
    throw e;
  }
}
```

- [ ] **Step 3: Create `LoginForm.tsx`**

```tsx
'use client';
import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { loginAction } from '../actions';

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') ?? '/';
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const result = await loginAction(fd);
      if (result.ok) {
        router.replace(next);
      } else {
        setError(result.error ?? 'Login failed');
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium text-text">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium text-text">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </div>
      {error && <div className="text-sm text-critical">{error}</div>}
      <Button type="submit" disabled={pending}>
        {pending ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
```

- [ ] **Step 4: Create `src/app/(auth)/login/page.tsx`**

```tsx
import { Suspense } from 'react';
import { BrandMark } from '@/components/shell/BrandMark';
import { LoginForm } from '@/features/auth/components/LoginForm';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-8 rounded-lg border border-line bg-paper p-8 shadow-sm">
        <div className="flex flex-col items-center gap-3">
          <BrandMark size={44} />
          <h1 className="font-display text-xl font-bold tracking-tight">Arham Always Care</h1>
          <p className="text-xs uppercase tracking-[0.14em] text-muted">IPD</p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Run typecheck + lint**

```bash
pnpm run typecheck
pnpm run lint
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(auth): login page with credentials form + server action"
```

---

## Task 10: Today page stub + (app) layout

**Files:**
- Create: `src/features/reports/components/TodayDashboard.tsx`
- Create: `src/app/(app)/layout.tsx`, `src/app/(app)/page.tsx`
- Delete: default `src/app/page.tsx` (the scaffold's)

- [ ] **Step 1: Move default page out of the way**

```bash
rm -f src/app/page.tsx
```

- [ ] **Step 2: Create `src/features/reports/components/TodayDashboard.tsx`**

```tsx
import { Activity, AlertTriangle, ArrowUpRight, Scissors, Skull } from 'lucide-react';

const tiles = [
  { label: 'Admissions today', value: '—', icon: ArrowUpRight, tone: 'accent' as const },
  { label: 'Surgeries today', value: '—', icon: Scissors, tone: 'neutral' as const },
  { label: 'Discharges today', value: '—', icon: Activity, tone: 'stable' as const },
  { label: 'Deaths today', value: '—', icon: Skull, tone: 'critical' as const },
];

const toneClasses = {
  accent: 'bg-accent-soft text-accent-ink',
  neutral: 'bg-surface-2 text-text',
  stable: 'bg-stable-bg text-stable',
  critical: 'bg-critical-bg text-critical',
};

export function TodayDashboard() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Today</h1>
        <p className="mt-1 text-sm text-muted">Floor at a glance</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <div key={t.label} className="rounded-lg border border-line bg-paper p-4">
              <div
                className={`mb-3 inline-flex h-8 w-8 items-center justify-center rounded-md ${toneClasses[t.tone]}`}
              >
                <Icon size={16} />
              </div>
              <div className="font-display text-2xl font-bold">{t.value}</div>
              <div className="mt-1 text-xs text-muted">{t.label}</div>
            </div>
          );
        })}
      </div>

      <div className="rounded-lg border border-line bg-paper p-5">
        <div className="mb-3 flex items-center gap-2">
          <AlertTriangle size={16} className="text-observation" />
          <h2 className="font-display text-base font-bold">Needs attention</h2>
        </div>
        <p className="text-sm text-muted">No data yet — admit your first patient to see this populate.</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `src/app/(app)/layout.tsx`**

```tsx
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/shell/AppShell';
import { getCurrentUser } from '@/lib/auth';

const roleLabel: Record<string, string> = {
  STAFF: 'Floor staff',
  DOCTOR: 'Doctor',
  ADMIN: 'Admin',
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  return (
    <AppShell
      user={{
        name: user.name,
        role: roleLabel[user.role] ?? user.role,
        isAdmin: user.role === 'ADMIN',
      }}
    >
      {children}
    </AppShell>
  );
}
```

- [ ] **Step 4: Create `src/app/(app)/page.tsx`**

```tsx
import { TodayDashboard } from '@/features/reports/components/TodayDashboard';

export default function HomePage() {
  return <TodayDashboard />;
}
```

- [ ] **Step 5: Run dev server + smoke test manually**

```bash
pnpm run dev
```
Visit `http://localhost:3000` — should redirect to `/login`. Login form should render with brand. Don't sign in yet (no users).

Kill the dev server.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(home): TodayDashboard stub + (app) layout with auth guard"
```

---

## Task 11: Seed script

**Files:**
- Create: `prisma/seed.ts`

- [ ] **Step 1: Write `prisma/seed.ts`**

```ts
import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const SEED_USERS = [
  { email: 'admin@arham.care', name: 'Asha (Reception)', role: Role.ADMIN, password: 'admin1234' },
  { email: 'mehta@arham.care', name: 'Dr. Mehta', role: Role.DOCTOR, password: 'doctor1234' },
  { email: 'iyer@arham.care', name: 'Dr. Iyer', role: Role.DOCTOR, password: 'doctor1234' },
  { email: 'sahil@arham.care', name: 'Sahil (paramedic)', role: Role.STAFF, password: 'staff1234' },
  { email: 'pooja@arham.care', name: 'Nurse Pooja', role: Role.STAFF, password: 'staff1234' },
  { email: 'anu@arham.care', name: 'Nurse Anu', role: Role.STAFF, password: 'staff1234' },
];

async function main() {
  for (const u of SEED_USERS) {
    const passwordHash = await bcrypt.hash(u.password, 12);
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, active: true },
      create: {
        email: u.email,
        passwordHash,
        name: u.name,
        role: u.role,
        active: true,
      },
    });
  }
  // biome-ignore lint/suspicious/noConsoleLog: seed output
  console.log(`Seeded ${SEED_USERS.length} users.`);
}

main()
  .catch((e) => {
    // biome-ignore lint/suspicious/noConsoleLog: seed output
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Run seed**

```bash
pnpm run db:seed
```
Expected: `Seeded 6 users.`

- [ ] **Step 3: Verify with Prisma Studio (manual check)**

```bash
pnpm run db:studio
```
Open browser at the URL it prints; verify 6 users exist. Close studio.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(db): seed 6 default users (admin/doctor/staff)"
```

---

## Task 12: E2E smoke test (Playwright) — login → home

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/login.spec.ts`, `tests/e2e/helpers.ts`

- [ ] **Step 1: Install Playwright**

```bash
pnpm add -D @playwright/test@1.48.2
pnpm dlx playwright install chromium
```

- [ ] **Step 2: Create `playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'list' : 'html',
  use: { baseURL: 'http://localhost:3000', trace: 'on-first-retry' },
  projects: [
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'chromium-mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

- [ ] **Step 3: Create `tests/e2e/helpers.ts`**

```ts
import type { Page } from '@playwright/test';

export async function login(page: Page, email = 'admin@arham.care', password = 'admin1234') {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('/');
}
```

- [ ] **Step 4: Create `tests/e2e/login.spec.ts`**

```ts
import { expect, test } from '@playwright/test';
import { login } from './helpers';

test('redirects unauthenticated user to /login', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login(\?|$)/);
  await expect(page.getByRole('heading', { name: /arham always care/i })).toBeVisible();
});

test('rejects wrong password', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('admin@arham.care');
  await page.getByLabel('Password').fill('wrong-pw');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByText(/invalid email or password/i)).toBeVisible();
});

test('admin logs in and lands on Today', async ({ page }) => {
  await login(page);
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
});
```

- [ ] **Step 5: Run e2e**

```bash
pnpm run test:e2e
```
Expected: all 6 tests pass (3 tests × 2 projects).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "test(e2e): login flow smoke test (Playwright, desktop + mobile)"
```

---

## Task 13: GitHub Actions CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  verify:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: arham
          POSTGRES_PASSWORD: arham_dev
          POSTGRES_DB: arham_ipd
        ports: ['5432:5432']
        options: >-
          --health-cmd "pg_isready -U arham -d arham_ipd"
          --health-interval 10s --health-timeout 5s --health-retries 5

    env:
      DATABASE_URL: postgresql://arham:arham_dev@localhost:5432/arham_ipd?schema=public
      AUTH_SECRET: ci-secret-for-build-only
      AUTH_URL: http://localhost:3000
      STORAGE_DRIVER: local
      LOCAL_UPLOAD_DIR: ./uploads
      NODE_ENV: test

    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec prisma migrate deploy
      - run: pnpm run typecheck
      - run: pnpm run lint
      - run: pnpm run test
      - run: pnpm dlx playwright install --with-deps chromium
      - run: pnpm run db:seed
      - run: pnpm run test:e2e
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "ci: GitHub Actions workflow (typecheck/lint/unit/e2e on Postgres)"
```

---

## Task 14: Husky + lint-staged pre-commit hook

**Files:**
- Create: `.husky/pre-commit`
- Modify: `package.json`

- [ ] **Step 1: Install hooks**

```bash
pnpm add -D husky@9.1.6 lint-staged@15.2.10
pnpm dlx husky init
```

- [ ] **Step 2: Configure lint-staged in `package.json`**

```json
"lint-staged": {
  "*.{ts,tsx}": ["biome format --write", "biome check --write"],
  "*.{json,md}": ["biome format --write"]
}
```

- [ ] **Step 3: Replace `.husky/pre-commit`**

```bash
pnpm exec lint-staged
pnpm exec tsc --noEmit
```

- [ ] **Step 4: Test the hook with a trivial change**

```bash
touch dummy.md
echo '# test' > dummy.md
git add dummy.md
git commit -m "test: husky hook"
```
Expected: passes. Then:
```bash
git rm dummy.md
git commit -m "test: cleanup"
```

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: husky + lint-staged pre-commit hook"
```

---

## Phase 0 — Done-when checklist

- [ ] `pnpm run build` succeeds
- [ ] `pnpm run typecheck` succeeds
- [ ] `pnpm run lint` reports zero errors
- [ ] `pnpm run test` (Vitest) all green
- [ ] `pnpm run test:e2e` (Playwright) all green
- [ ] Login as `admin@arham.care / admin1234` lands on Today
- [ ] Layout switches to BottomNav at <760px width
- [ ] Theme switcher changes `data-theme` on `<html>` and persists across reload via cookie

## Self-Review (writing-plans skill checklist)

**1. Spec coverage:**
- Foundation/stack (§2) → Tasks 0–3
- Themes (§8) → Task 4, 7
- Code organization (§9) → Folder structure section + Tasks 5–10
- Auth (§4 RBAC scaffolding) → Tasks 8, 9 (full RBAC matrix is enforced in later phases — Phase 0 only enforces "logged-in vs not")
- DB indexes (§7.2) → User indexes shipped in Task 3 schema; other indexes added in their respective phases
- E2E test → Task 12
- CI → Task 13
- Pre-commit hooks → Task 14

**2. Placeholder scan:** None — every code block is concrete.

**3. Type consistency:** `Theme` type is defined once in `src/lib/theme.ts` and reused. `Role` enum lives in Prisma; the layout casts via `getCurrentUser()` which centralises shape.

**4. Open items:** Image-side variant cache table, audit log writer, full RBAC dispatcher are deferred to Phase 1/2 where the entities exist.
