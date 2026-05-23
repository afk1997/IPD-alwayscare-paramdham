/**
 * Shared scaffolding for the qa-deep-* probe scripts. Each probe runs
 * desktop + mobile viewports, captures screenshots into
 * test-results/qa-deep/<probe>/, collects pageerror/console.error, and
 * appends findings to a single per-probe report file.
 */
import { mkdirSync } from 'node:fs';
import { appendFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { type Browser, type BrowserContext, type Page, chromium, devices } from '@playwright/test';

export const QA = '__qa__';
export const ADMIN = { email: 'admin@arham.care', password: 'admin1234' };
export const DOCTOR = { email: 'mehta@arham.care', password: 'doctor1234' };
export const STAFF = { email: 'sahil@arham.care', password: 'staff1234' };

export const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

export interface ProbeContext {
  name: string;
  browser: Browser;
  desktop: BrowserContext;
  mobile: BrowserContext;
  outDir: string;
  errors: string[];
  finding(severity: 'critical' | 'high' | 'medium' | 'low' | 'info', message: string): Promise<void>;
}

export async function startProbe(name: string): Promise<ProbeContext> {
  const outDir = join('test-results', 'qa-deep', name);
  mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const desktop = await browser.newContext({ baseURL: BASE_URL, viewport: { width: 1280, height: 800 } });
  const mobile = await browser.newContext({
    ...devices['Pixel 7'],
    deviceScaleFactor: 1,
    baseURL: BASE_URL,
  });

  const errors: string[] = [];
  for (const ctx of [desktop, mobile]) {
    ctx.on('page', (p) => attachErrorListeners(p, errors));
  }

  await writeFile(join(outDir, 'findings.md'), `# ${name} findings\n\n`);

  return {
    name,
    browser,
    desktop,
    mobile,
    outDir,
    errors,
    async finding(sev, msg) {
      await appendFile(join(outDir, 'findings.md'), `- **[${sev.toUpperCase()}]** ${msg}\n`);
    },
  };
}

export async function endProbe(ctx: ProbeContext) {
  if (ctx.errors.length > 0) {
    await ctx.finding('high', `${ctx.errors.length} page/console error(s) during run`);
    for (const e of ctx.errors.slice(0, 20)) await ctx.finding('high', `console: ${e}`);
  }
  await ctx.browser.close();
}

function attachErrorListeners(page: Page, errors: string[]) {
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message.slice(0, 200)}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const txt = msg.text();
      // Filter known third-party noise: lucide-react icons sometimes log
      // about deprecated React APIs on dev builds.
      if (/lucide/.test(txt)) return;
      errors.push(`console.error: ${txt.slice(0, 200)}`);
    }
  });
}

export async function login(page: Page, creds = ADMIN) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(creds.email);
  await page.getByLabel('Password').fill(creds.password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL((u) => new URL(u).pathname === '/', { timeout: 60_000 });
}

export async function screenshot(
  page: Page,
  ctx: ProbeContext,
  label: string,
  variant: 'desktop' | 'mobile',
) {
  await page.waitForLoadState('networkidle').catch(() => undefined);
  const file = join(ctx.outDir, `${label}-${variant}.png`);
  // fullPage screenshots on mobile (393px wide) can exceed 2000px tall,
  // which trips the image-reading pipeline. Cap with a clip on mobile
  // so screenshots stay reviewable; desktop captures stay full-page.
  if (variant === 'mobile') {
    await page.screenshot({
      path: file,
      clip: { x: 0, y: 0, width: 393, height: 1800 },
    });
  } else {
    await page.screenshot({ path: file, fullPage: true });
  }
}

/** Convenience wrapper: open one page in both viewports and capture. */
export async function snap(ctx: ProbeContext, label: string, navigate: (page: Page) => Promise<void>) {
  const d = await ctx.desktop.newPage();
  attachErrorListeners(d, ctx.errors);
  await navigate(d);
  await screenshot(d, ctx, label, 'desktop');
  await d.close();

  const m = await ctx.mobile.newPage();
  attachErrorListeners(m, ctx.errors);
  await navigate(m);
  await screenshot(m, ctx, label, 'mobile');
  await m.close();
}

export function qaLabel(prefix: string): string {
  return `${QA}${prefix}-${Math.random().toString(36).slice(2, 7)}`;
}
