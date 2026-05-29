/**
 * Probe: non-admin users are redirected away from /admin/trash and
 * /admin/audit-log and /documents.
 */
import { chromium } from '@playwright/test';

interface UserCreds {
  email: string;
  password: string;
  role: string;
}

const NON_ADMINS: UserCreds[] = [
  { email: 'mehta@arham.care', password: 'doctor1234', role: 'DOCTOR' },
  { email: 'sahil@arham.care', password: 'staff1234', role: 'STAFF' },
];

async function probeOne(u: UserCreds) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    viewport: { width: 1280, height: 800 },
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => process.stdout.write(`[pageerror] ${e.message.slice(0, 150)}\n`));

  await page.goto('/login');
  await page.getByLabel('Email').fill(u.email);
  await page.getByLabel('Password').fill(u.password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('/', { timeout: 60_000 });

  for (const path of ['/admin/trash', '/admin/audit-log', '/documents']) {
    await page.goto(path);
    // Each gate redirects non-ADMIN to '/'.
    await page.waitForURL('/', { timeout: 10_000 });
    process.stdout.write(`${u.role} -> ${path} -> / (gated)\n`);
  }

  await browser.close();
}

async function main() {
  for (const u of NON_ADMINS) await probeOne(u);
  process.stdout.write('OK: qa-trash-rbac\n');
}

main().catch((e) => {
  process.stderr.write(`${String(e)}\n`);
  process.exit(1);
});
