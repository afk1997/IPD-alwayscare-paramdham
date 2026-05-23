/**
 * Visit every top-level route in both desktop + mobile viewports and
 * capture a full-page screenshot. Records any pageerror / console.error
 * to findings.md. This is the wide-net coverage probe; deep flow probes
 * (admit, edit, delete, restore) live in their own files.
 */
import { endProbe, login, snap, startProbe } from './_lib';

async function main() {
  const ctx = await startProbe('qa-deep-pages');
  try {
    const pages: { label: string; path: string }[] = [
      { label: '01-login', path: '/login' },
      { label: '02-home-today', path: '/' },
      { label: '03-patients-list', path: '/patients' },
      { label: '04-patients-new', path: '/patients/new' },
      { label: '05-reports', path: '/reports' },
      { label: '06-reports-today', path: '/reports/today' },
      { label: '07-reports-by-animal', path: '/reports/by-animal' },
      { label: '08-documents', path: '/documents' },
      { label: '09-admin-users', path: '/admin/users' },
      { label: '10-admin-audit-log', path: '/admin/audit-log' },
      { label: '11-admin-trash', path: '/admin/trash' },
    ];

    // Login first in both contexts. ADMIN sees the largest surface.
    for (const c of [ctx.desktop, ctx.mobile]) {
      const p = await c.newPage();
      await login(p);
      await p.close();
    }

    for (const { label, path } of pages) {
      try {
        await snap(ctx, label, async (page) => {
          await page.goto(path, { waitUntil: 'domcontentloaded' });
          await page.waitForLoadState('networkidle').catch(() => undefined);
          // Give async tags / fonts a beat to settle.
          await page.waitForTimeout(800);
        });
        process.stdout.write(`  ✓ ${label}\n`);
      } catch (e) {
        await ctx.finding(
          'high',
          `failed to capture ${label} (${path}): ${e instanceof Error ? e.message : 'unknown'}`,
        );
        process.stdout.write(`  ✗ ${label}: ${e instanceof Error ? e.message : String(e)}\n`);
      }
    }
  } finally {
    await endProbe(ctx);
  }
}

main().catch((e) => {
  process.stderr.write(`${String(e)}\n`);
  process.exit(1);
});
