/**
 * VIEWER walkthrough probe.
 *
 * Creates a temporary VIEWER user, signs in via Playwright in both
 * desktop and mobile contexts, and asserts that write CTAs are absent
 * and that write-only routes redirect away.
 *
 * Run with the dev server already running on http://localhost:3000:
 *   pnpm exec dotenv -e .env.local -- tsx scripts/qa-deep/qa-deep-viewer-walkthrough.ts
 */
import bcrypt from 'bcryptjs';
import { prisma } from '../../src/lib/prisma';
import { endProbe, login, snap, startProbe } from './_lib';

const VIEWER_EMAIL = '__qa__viewer@qa-roles.local';
const VIEWER_PASSWORD = 'Viewer#Probe2026';

async function ensureViewerUser() {
  const passwordHash = await bcrypt.hash(VIEWER_PASSWORD, 12);
  return prisma.user.upsert({
    where: { email: VIEWER_EMAIL },
    update: { role: 'VIEWER', active: true, passwordHash },
    create: {
      email: VIEWER_EMAIL,
      name: '__qa__viewer',
      role: 'VIEWER',
      passwordHash,
      active: true,
    },
  });
}

async function deleteViewerUser() {
  await prisma.user.deleteMany({ where: { email: VIEWER_EMAIL } });
}

const HIDDEN_TEXT = [
  'New entry',
  'Log activity',
  'Edit details',
  'Discharge',
  'Record death',
  'Upload document',
];

async function main() {
  await ensureViewerUser();
  const ctx = await startProbe('viewer-walkthrough');

  try {
    const patient = await prisma.animal.findFirst({
      where: { deletedAt: null },
      select: { id: true },
    });

    for (const variant of ['desktop', 'mobile'] as const) {
      const browserCtx = variant === 'desktop' ? ctx.desktop : ctx.mobile;
      const page = await browserCtx.newPage();

      await login(page, { email: VIEWER_EMAIL, password: VIEWER_PASSWORD });

      // 1. Today page — no write CTAs.
      await page.goto('/');
      await page.waitForLoadState('networkidle').catch(() => undefined);
      const todayHtml = await page.content();
      for (const text of HIDDEN_TEXT) {
        if (todayHtml.includes(text)) {
          await ctx.finding('high', `${variant}: "${text}" visible on / for VIEWER`);
        }
      }

      // 2. Patient list.
      await page.goto('/patients');
      await page.waitForLoadState('networkidle').catch(() => undefined);
      const patientsHtml = await page.content();
      if (patientsHtml.includes('Admit patient') || patientsHtml.includes('New admission')) {
        await ctx.finding('high', `${variant}: admit CTA visible on /patients for VIEWER`);
      }

      // 3. Patient detail (if any patient exists).
      if (patient) {
        await page.goto(`/patients/${patient.id}`);
        await page.waitForLoadState('networkidle').catch(() => undefined);
        const detailHtml = await page.content();
        for (const text of HIDDEN_TEXT) {
          if (detailHtml.includes(text)) {
            await ctx.finding('high', `${variant}: "${text}" visible on patient detail for VIEWER`);
          }
        }
      }

      // 4. Write-only route should redirect.
      await page.goto('/patients/new');
      await page.waitForLoadState('networkidle').catch(() => undefined);
      const newPathname = new URL(page.url()).pathname;
      if (newPathname === '/patients/new') {
        await ctx.finding('critical', `${variant}: VIEWER reached /patients/new (no redirect)`);
      }

      // 5. Admin route should redirect or 403.
      await page.goto('/admin/users');
      await page.waitForLoadState('networkidle').catch(() => undefined);
      const adminPathname = new URL(page.url()).pathname;
      if (adminPathname === '/admin/users') {
        await ctx.finding('critical', `${variant}: VIEWER reached /admin/users`);
      }

      await snap(ctx, `summary-${variant}`, async (p) => {
        await p.goto('/');
        await p.waitForLoadState('networkidle').catch(() => undefined);
      });

      await page.close();
    }

    process.stdout.write(`VIEWER walkthrough complete. Findings in ${ctx.outDir}/findings.md\n`);
  } finally {
    await endProbe(ctx);
    await deleteViewerUser();
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  process.stderr.write(`${String(e)}\n`);
  process.exit(1);
});
