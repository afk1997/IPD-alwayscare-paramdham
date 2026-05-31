# PWA Conversion — Design

- **Date:** 2026-05-31
- **Status:** Draft (awaiting user review)
- **Realizes:** "Phase 6 (PWA)" deferred in `docs/superpowers/specs/2026-05-28-app-performance-design.md`
- **Area:** App-wide (Next.js App Router shell, service worker, manifest)

## Problem

The app isn't installable, has no offline resilience, and leaves repeat-load caching on the table. We want it to be a real PWA — installable to a home screen, resilient when the network drops, and noticeably faster on repeat visits — and to then measure the speedup before deciding on further work.

## Goals

1. **Installable** on Android/Chrome/desktop (and iOS via Add-to-Home-Screen): web manifest + icons + theme color.
2. **Service worker** that precaches the build's static assets and runtime-caches images, making repeat loads fast and the app shell resilient.
3. **Branded offline page** when a navigation fails with no network (instead of the browser error).
4. **Custom in-app "Install app"** affordance for staff adoption, and a **controlled "refresh to update"** prompt (no surprise reloads mid-entry).
5. A **before/after Lighthouse + web-vitals** capture so the speed gain is visible.

## Non-goals / hard constraints

- **No offline patient data, no offline write queue, no caching of authed HTML/data.** Pages and data are always fetched fresh online; offline → the offline fallback page. (Per owner: device/data privacy is not a gating concern here — see project memory — so this scope is about simplicity/speed, not privacy.)
- **The structural perf refactors stay on their own track** (perf-spec phases 2–5: optimistic mutations, list virtualization, auth memoization, splitting the client surface). Not in this spec.
- **No new vulnerable dependencies.** `@serwist/next@9.5.11` + `serwist@9.5.11` were audited (isolated `npm audit`): no high/critical and no serwist-specific advisory (the only moderates are `postcss` pulled via `next`, already in the project). A `pnpm audit --audit-level=high` gate is added.
- **SW is production-only.** Disabled in dev (`next dev`); test via `pnpm build && pnpm start`.

## Decisions (from brainstorming)

| Decision | Choice |
| --- | --- |
| Scope | PWA only (measure, then decide on more) |
| Offline model | Installable + fast; precache shell/static, runtime-cache images (SWR); online-only data; branded offline page |
| SW tooling | `@serwist/next` (modern, maintained, App-Router-native, TS SW) |
| Install UX | Custom "Install app" button (capture `beforeinstallprompt`; iOS gets a Share→Add hint) |
| Update UX | Prompt-to-refresh toast (controlled), not silent auto-update |
| Icons/theme | Generated from the existing `BrandMark` paw SVG via `sharp`; theme color teal `#0E7C7B` |

## Architecture

### Dependency + config — `next.config.ts`
Wrap the config with serwist and extend CSP:
```ts
import withSerwistInit from '@serwist/next';
const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development',
  reloadOnOnline: true,
});
export default withSerwist(nextConfig);
```
CSP additions (today's CSP omits these and would block the SW/manifest): add `worker-src 'self'` and `manifest-src 'self'`.

### Manifest — `src/app/manifest.ts` (Next metadata route → `/manifest.webmanifest`)
`name: "Arham Always Care — IPD"`, `short_name: "Arham IPD"`, `description`, `start_url: "/"`, `scope: "/"`, `display: "standalone"`, `orientation: "portrait"`, `background_color: "#F5F8FA"`, `theme_color: "#0E7C7B"`, `icons`: 192×192, 512×512, and a 512×512 `purpose: "maskable"`.

### Icons — generated from `BrandMark`
`scripts/gen-icons.ts` (run manually / committed output) rasterizes the teal paw `BrandMark` SVG with `sharp`:
- `public/icons/icon-192.png`, `icon-512.png`, `icon-maskable-512.png` (maskable gets ~20% safe-zone padding on a teal background), `apple-touch-icon.png` (180×180).
- `src/app/icon.png` (favicon/any) and `src/app/apple-icon.png` — Next auto-injects `<link>`s for these.

### Layout — `src/app/layout.tsx`
Add a `viewport` export (`themeColor: '#0E7C7B'`, `width: 'device-width'`, `initialScale: 1`, `viewportFit: 'cover'`) and `appleWebApp` metadata (`capable: true`, `statusBarStyle: 'default'`, `title: 'Arham IPD'`) for a clean iOS standalone launch. The manifest link is auto-added by `manifest.ts`.

### Service worker — `src/app/sw.ts` (serwist, TypeScript)
- Precache: `self.__SW_MANIFEST` (serwist injects the build's static assets) **plus** the offline page (`/~offline`).
- `skipWaiting: false`, `clientsClaim: true`, `navigationPreload: true` — a new SW **waits** so the UI can prompt; it activates on a `SKIP_WAITING` message from the client.
- Runtime caching (custom, ahead of serwist's `defaultCache`):
  - **`/api/files/*` (signed media)** → `StaleWhileRevalidate`, cache `media`, `ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 30d })`.
  - **`/_next/image*`** → `StaleWhileRevalidate`, cache `next-image`.
  - **`_next/static/*`, fonts, etc.** → serwist `defaultCache` (CacheFirst for immutable assets).
- `fallbacks`: document-destination requests that fail offline serve the precached `/~offline`.
- **Never handled by the SW** (pass through to network): `/api/auth/*`, `/api/patients/*/report`, and any non-GET request.

### Offline page — `src/app/~offline/page.tsx`
A small static, brandable page ("You're offline — reconnect to continue"). Excluded from auth middleware (add `~offline` to the matcher negative-lookahead) so it's reachable/precacheable without a session; when offline the SW serves it from cache regardless.

### Install + update — client, mounted once in `AppShell`
- **`src/components/pwa/PwaController.tsx`**: registers `/sw.js` (production only), listens for an installing/waiting worker, and on `waiting` shows a `ToastProvider` toast — **"New version available — Refresh"** — whose action posts `SKIP_WAITING` to the worker and reloads on `controllerchange`.
- **`src/components/pwa/InstallButton.tsx`**: captures `beforeinstallprompt` (preventDefault + stash the event), renders an "Install app" control (side-nav footer / dismissible banner) that calls `prompt()`; hides once installed (`appinstalled` / `display-mode: standalone`). On iOS Safari (no event) it shows a brief "Share → Add to Home Screen" hint.

## Data flow

1. First load: app served normally; `PwaController` registers the SW (prod). SW precaches static assets + offline page.
2. Repeat loads: static chunks + images served from SW caches (instant); pages still fetched online (fresh data).
3. Offline navigation: SW serves the precached `/~offline` document.
4. New deploy: new SW installs and waits → toast → user taps Refresh → SW activates, page reloads on latest.
5. Install: `beforeinstallprompt` → "Install app" button → home-screen icon (manifest/icons).

## Error handling

- SW registration failure (unsupported browser / blocked) → app works as a normal web app; `PwaController` no-ops, no error surfaced.
- `beforeinstallprompt` never fires (already installed, iOS, unsupported) → install button hidden / iOS hint shown.
- A runtime-cache miss while offline for an uncacheable resource → normal network error within the offline-page boundary.

## Testing & measurement

- **Unit (vitest + Testing Library):** `PwaController` update flow (mock a `waiting` SW registration → asserts the refresh toast + `SKIP_WAITING` post) and `InstallButton` (dispatch a fake `beforeinstallprompt` → button shows → `prompt()` called; simulate iOS → hint shown). `gen-icons` output sizes via `sharp.metadata()`.
- **Build check:** `pnpm build` produces `public/sw.js`; `/manifest.webmanifest` returns valid JSON with the required icons; `next build` succeeds with the serwist wrapper.
- **E2E (Playwright, prod build):** manifest served; SW registers; offline navigation (`context.setOffline(true)`) → offline page; install button visible in Chromium.
- **Measurement:** Lighthouse (PWA + Performance) and web-vitals **before vs after**, captured in the PR — the repeat-visit/install gains are the headline. (Run against `pnpm start`, not dev.)

## Out of scope / YAGNI

- Offline reading of patient data; offline write/sync queue.
- Caching authed HTML or API/data responses.
- Push notifications / background sync / periodic sync.
- The perf-spec structural refactors (phases 2–5).

## Caveats

- Service worker only runs in production builds — local verification is `pnpm build && pnpm start`.
- On Vercel, serwist emits `public/sw.js` at build; CSP must allow `worker-src 'self'` (added here).
- iOS Safari has no `beforeinstallprompt` and limited SW support — install is the manual Share→Add flow; offline caching is best-effort there.
