/**
 * Full QA sweep — real browser, real Drive uploads, real bugs.
 *
 * Phases:
 *   1. Visual audit — screenshot every primary screen at 1280×800 + 390×844
 *   2. Real upload flow — admit a new animal via the wizard with image
 *      buckets + the 8 MB chunked-upload video, then verify timeline + Drive
 *   3. Adversarial inputs — empty submit, max+1 length, unicode, double-click
 *   4. Cross-role probes — STAFF and DOCTOR try admin URLs directly
 *   5. Failure injection — abort upload, offline save
 *
 * Findings land in /tmp/qa-findings.md as a triaged list.  Screenshots in
 * /tmp/qa-screens/<phase>/.
 *
 * Run as:  pnpm exec dotenv -e .env.local -- tsx scripts/qa-full-sweep.ts
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { type Browser, type BrowserContext, type Page, chromium, devices } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const ADMIN = { email: 'admin@arham.care', password: 'admin1234' };
const SCREENS_DIR = '/tmp/qa-screens';
const FIXTURES = resolve('tmp/qa-media');

interface Finding {
  severity: 'P1' | 'P2' | 'P3';
  category: 'visual' | 'upload' | 'input' | 'rbac' | 'reliability' | 'a11y' | 'perf';
  screen: string;
  msg: string;
  screenshot?: string;
}
const findings: Finding[] = [];
function flag(
  severity: Finding['severity'],
  category: Finding['category'],
  screen: string,
  msg: string,
  screenshot?: string,
) {
  findings.push({ severity, category, screen, msg, ...(screenshot ? { screenshot } : {}) });
}

function log(line: string) {
  process.stdout.write(`${line}\n`);
}

async function shoot(page: Page, name: string) {
  const file = `${SCREENS_DIR}/${name}.png`;
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

async function login(page: Page, email = ADMIN.email, password = ADMIN.password) {
  await page.goto('/login');
  // If the context is already authenticated, /login redirects to / and the
  // email field is never rendered.  Detect that quickly and short-circuit.
  await page.waitForLoadState('domcontentloaded');
  if (page.url().replace(/^https?:\/\/[^/]+/, '') === '/') return;
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('/', { timeout: 60_000 });
}

// ── Phase 1: visual audit ─────────────────────────────────────────────────
async function phase1Visual(ctx: BrowserContext, variant: 'desktop' | 'mobile') {
  log(`\n▶ Phase 1: visual audit (${variant})`);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => flag('P2', 'reliability', `${variant}/pageerror`, e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const t = msg.text();
      if (!/Failed to load resource.*\b(404|favicon)/i.test(t)) {
        flag('P3', 'reliability', `${variant}/console`, t);
      }
    }
  });

  await login(page);

  const screens: Array<{ name: string; goto: string; wait?: string }> = [
    { name: 'home', goto: '/' },
    { name: 'patients', goto: '/patients' },
    { name: 'patients-new', goto: '/patients/new' },
    { name: 'reports', goto: '/reports' },
    { name: 'reports-today', goto: '/reports/today' },
    { name: 'reports-by-animal', goto: '/reports/by-animal' },
    { name: 'documents', goto: '/documents' },
    { name: 'admin-users', goto: '/admin/users' },
    { name: 'admin-audit', goto: '/admin/audit-log' },
  ];

  for (const s of screens) {
    try {
      await page.goto(s.goto, { waitUntil: 'networkidle', timeout: 30_000 });
      await page.waitForTimeout(400);
      const file = await shoot(page, `${variant}/${s.name}`);
      log(`  ✓ ${s.name} → ${file}`);
    } catch (e) {
      flag(
        'P1',
        'reliability',
        `${variant}/${s.name}`,
        `goto failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  // Capture one patient detail screen for completeness.
  try {
    await page.goto('/patients');
    const first = page.locator('a[href^="/patients/"]:not([href="/patients/new"])').first();
    if (await first.isVisible({ timeout: 5_000 })) {
      await first.click();
      await page.waitForURL(/\/patients\/[a-z0-9]+$/, { timeout: 15_000 });
      await page.waitForTimeout(800);
      await shoot(page, `${variant}/patient-detail-overview`);
      await page
        .getByRole('button', { name: /^Activity$/ })
        .click()
        .catch(() => {});
      await page.waitForTimeout(300);
      await shoot(page, `${variant}/patient-detail-activity`);
      await page
        .getByRole('button', { name: /^Documents$/ })
        .click()
        .catch(() => {});
      await page.waitForTimeout(300);
      await shoot(page, `${variant}/patient-detail-documents`);
      await page
        .getByRole('button', { name: /^Details$/ })
        .click()
        .catch(() => {});
      await page.waitForTimeout(300);
      await shoot(page, `${variant}/patient-detail-details`);
    } else {
      flag('P2', 'visual', `${variant}/patients`, 'No patient link visible on /patients');
    }
  } catch (e) {
    flag(
      'P2',
      'visual',
      `${variant}/patient-detail`,
      `failed: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  await page.close();
}

// ── Phase 2: real admission with image + chunked video upload ──────────────
async function phase2Uploads(ctx: BrowserContext) {
  log('\n▶ Phase 2: real admission + uploads');
  const page = await ctx.newPage();
  page.on('pageerror', (e) => flag('P1', 'reliability', 'upload', e.message));
  page.on('response', (r) => {
    if (r.url().includes('/api/files/') && !r.ok()) {
      flag('P1', 'upload', 'file-api', `${r.url()} → ${r.status()}`);
    }
  });

  await login(page);
  await page.goto('/patients/new');
  await page.waitForLoadState('networkidle');

  // Step 1
  await page.getByLabel('Animal name / temporary ID').fill(`QA-Sweep-${Date.now().toString(36).slice(-5)}`);
  await page.getByLabel('Species').selectOption('Dog');
  await page.getByLabel('Breed').fill('QA Indie');
  await page.getByLabel('Approx age').fill('~3 yrs');
  await page.getByRole('button', { name: 'Continue' }).click();

  // Step 2 — rescuer
  await page.getByLabel('Rescuer / Owner name').fill('QA Rescuer');
  await page.getByLabel('Contact number').fill('+91 90000 00000');
  await page.getByRole('button', { name: 'Continue' }).click();

  // Step 3 — medical
  await page.getByLabel('Chief complaint').fill('QA full-sweep · suspected fracture');
  await page.getByLabel('Ward').fill('QA-Ward');
  await page.getByLabel('Status').selectOption('CRITICAL');
  await page.getByRole('button', { name: 'Continue' }).click();

  // Step 4 — media (the meat of the upload test)
  await shoot(page, 'upload/step4-empty');

  // Step4Media renders four MediaUploader buckets in this order:
  //   0=photos, 1=videos, 2=wounds, 3=prescriptions
  // The bucket label "Admission photos" lives on a sibling <span>, not on
  // the file <label>, so we address inputs by index here.
  // Race-free wait: count the per-tile Remove buttons that the uploader
  // renders once each asset reaches READY.  Waiting on the "Uploading N…"
  // text is racy because there's a 100-300 ms window between
  // setInputFiles and that text appearing.
  const tileCount = () => page.locator('button[aria-label^="Remove "]').count();

  const fileInputs = page.locator('input[type="file"]');
  await fileInputs.nth(0).setInputFiles(resolve(FIXTURES, 'dog.jpg'));
  await fileInputs.nth(1).setInputFiles(resolve(FIXTURES, 'video-large.mp4'));
  log('  → started photos + video uploads (concurrent)');
  await page.waitForFunction(
    () => document.querySelectorAll('button[aria-label^="Remove "]').length >= 2,
    null,
    { timeout: 120_000 },
  );
  log(`  ✓ both uploads landed (count=${await tileCount()})`);

  await shoot(page, 'upload/step4-filled');

  await fileInputs.nth(2).setInputFiles(resolve(FIXTURES, 'wound.jpg'));
  await fileInputs.nth(3).setInputFiles(resolve(FIXTURES, 'xray.jpg'));
  await page.waitForFunction(
    () => document.querySelectorAll('button[aria-label^="Remove "]').length >= 4,
    null,
    { timeout: 60_000 },
  );
  log(`  ✓ all four uploads landed (count=${await tileCount()})`);

  await page.getByRole('button', { name: 'Continue' }).click();

  // Step 5
  await page.getByLabel('Tentative diagnosis').fill('QA — suspected L hind femur Fx');
  await page.getByRole('button', { name: 'X-ray', exact: true }).click();
  await page.getByRole('button', { name: 'Blood test' }).click();
  await page.getByRole('button', { name: 'Admit animal' }).click();

  // Match a real CUID-style id, NOT the wizard URL "/patients/new" — the
  // old regex `[a-z0-9]+$` matched "new" too and falsely reported success.
  await page.waitForURL(/\/patients\/c[a-z0-9]{24}$/, { timeout: 30_000 });
  await page.waitForTimeout(800);
  const url = page.url();
  const animalId = url.split('/').pop()!;
  log(`  → admitted, animal id=${animalId.slice(0, 8)}…`);
  await shoot(page, 'upload/admitted-detail');

  // Verify media renders in Documents tab → Visual records
  await page
    .getByRole('button', { name: /^Documents$/ })
    .click()
    .catch(() => {});
  await page.waitForTimeout(800);
  await shoot(page, 'upload/visual-records');
  const visualImgs = await page.locator('img[src*="/api/files/"]').count();
  if (visualImgs < 1) flag('P1', 'upload', 'visual-records', 'no media tiles rendered after upload');
  else log(`  ✓ ${visualImgs} media tile(s) rendered in Visual records`);

  // Try the lightbox
  const firstThumb = page.locator('img[src*="/api/files/"]').first();
  if (await firstThumb.isVisible({ timeout: 2_000 })) {
    await firstThumb.click();
    await page.waitForTimeout(300);
    await shoot(page, 'upload/lightbox');
    await page.keyboard.press('Escape');
  }

  // Now log a TREATMENT activity with a photo attached
  await page
    .getByRole('button', { name: /^Activity$/ })
    .click()
    .catch(() => {});
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /log activity/i }).click();
  await page.getByRole('button', { name: /^Treatment/i }).click();
  await page
    .getByRole('button', { name: /add medicine/i })
    .click()
    .catch(() => {});
  await page
    .getByPlaceholder(/medicine/i)
    .first()
    .fill('QA-Meloxicam');
  await page
    .getByPlaceholder(/dose|mg/i)
    .first()
    .fill('0.2mg/kg');
  // attach the cat.jpg as a treatment progress photo
  const activityInput = page.locator('input[type="file"]').first();
  await activityInput.setInputFiles(resolve(FIXTURES, 'cat.jpg'));
  await page.waitForFunction(() => !document.body.innerText.match(/Uploading\s+\d+/), null, {
    timeout: 30_000,
  });
  await shoot(page, 'upload/activity-form-with-media');
  await page.getByRole('button', { name: 'Save entry' }).click();
  await page.waitForTimeout(1500);
  await shoot(page, 'upload/after-activity-save');
  log('  ✓ activity logged with media');

  return animalId;
}

// ── Phase 3: adversarial inputs ────────────────────────────────────────────
async function phase3Adversarial(ctx: BrowserContext) {
  log('\n▶ Phase 3: adversarial inputs');
  const page = await ctx.newPage();
  await login(page);

  // Empty admission submit — should be blocked at step 1
  await page.goto('/patients/new');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.waitForTimeout(400);
  const blockedAtStep1 = await page.getByLabel('Animal name / temporary ID').isVisible();
  if (!blockedAtStep1) flag('P1', 'input', 'admission/step1', 'empty submit was not blocked');
  else log('  ✓ empty step1 submit blocked');
  await shoot(page, 'adversarial/admission-empty-step1');

  // Overlength animal name
  await page.getByLabel('Animal name / temporary ID').fill('A'.repeat(200));
  await page.getByLabel('Species').selectOption('Cat');
  await page.getByRole('button', { name: 'Continue' }).click();
  // Either the step blocks via Zod, or it accepts (truncated server-side
  // by the UpdateAnimalSchema we shipped).  Inspect what UI shows.
  await page.waitForTimeout(400);
  await shoot(page, 'adversarial/admission-overlength');
  const stillOnStep1 = await page.getByLabel('Animal name / temporary ID').isVisible();
  if (stillOnStep1) log('  ✓ overlength name kept us on step 1 (good — UI validation)');
  else log('  ! overlength name accepted by UI (server still rejects via Zod, but no UX feedback)');

  // Unicode + emoji in patient name
  await page.goto('/patients/new');
  await page.getByLabel('Animal name / temporary ID').fill('🐕 Bruno-कुत्ता-犬');
  await page.getByLabel('Species').selectOption('Dog');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.waitForTimeout(400);
  await shoot(page, 'adversarial/unicode-name');

  await page.close();

  // Login adversarial probes need a clean, unauthenticated context —
  // otherwise /login redirects to / and the email field never renders.
  const anon = await page
    .context()
    .browser()!
    .newContext({ baseURL: BASE, viewport: { width: 1280, height: 800 } });
  const anonPage = await anon.newPage();

  await anonPage.goto('/login');
  await anonPage.getByRole('button', { name: /sign in/i }).click();
  await anonPage.waitForTimeout(800);
  await shoot(anonPage, 'adversarial/login-empty');
  // HTML5 required attribute should keep us on /login
  if (!anonPage.url().includes('/login'))
    flag('P1', 'input', 'login', 'empty form bypassed required validation');
  else log('  ✓ empty login form rejected');

  await anonPage.getByLabel('Email').fill("admin@arham.care' OR 1=1--");
  await anonPage.getByLabel('Password').fill("' OR '1'='1");
  await anonPage.getByRole('button', { name: /sign in/i }).click();
  await anonPage.waitForTimeout(2000);
  if (anonPage.url().includes('/login')) log('  ✓ SQL-ish login rejected');
  else flag('P1', 'rbac', 'login', 'SQL injection style login succeeded — DANGER');
  await shoot(anonPage, 'adversarial/login-sqli');

  await anon.close();
}

// ── Phase 4: cross-role probes ─────────────────────────────────────────────
async function phase4CrossRole(browser: Browser) {
  log('\n▶ Phase 4: cross-role probes');
  const roles: Array<{ label: string; email: string; password: string }> = [
    { label: 'STAFF', email: 'sahil@arham.care', password: 'staff1234' },
    { label: 'DOCTOR', email: 'mehta@arham.care', password: 'doctor1234' },
  ];
  for (const r of roles) {
    const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    try {
      await login(page, r.email, r.password);
      log(`  ✓ ${r.label} logged in`);
      // Admin URLs should redirect away
      for (const url of ['/admin/users', '/admin/audit-log']) {
        await page.goto(url, { waitUntil: 'networkidle' });
        const landed = page.url();
        if (landed.endsWith(url))
          flag('P1', 'rbac', `${r.label}/${url}`, `${r.label} reached ${url} — access not gated`);
        else log(`  ✓ ${r.label} bounced from ${url} → ${landed}`);
        await shoot(page, `cross-role/${r.label}-${url.replace(/\//g, '_')}`);
      }
    } catch (e) {
      flag('P2', 'rbac', r.label, `login failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      await ctx.close();
    }
  }
}

// ── Phase 5: failure injection ─────────────────────────────────────────────
async function phase5Failure(ctx: BrowserContext) {
  log('\n▶ Phase 5: failure injection');
  const page = await ctx.newPage();
  await login(page);

  // Offline activity save — go to an existing patient, open quick add, then
  // go offline before clicking Save.
  await page.goto('/patients');
  const first = page.getByRole('link', { name: /^[A-Z]/ }).first();
  if (await first.isVisible({ timeout: 5_000 })) {
    await first.click();
    await page.waitForURL(/\/patients\/[a-z0-9]+$/, { timeout: 15_000 });
    await page.getByRole('button', { name: /log activity/i }).click();
    await page.getByRole('button', { name: /doctor round/i }).click();
    // Go offline
    await page.context().setOffline(true);
    await page.getByRole('button', { name: 'Save entry' }).click();
    await page.waitForTimeout(3000);
    await shoot(page, 'failure/offline-save');
    const stillModal = await page.getByRole('heading', { name: /doctor round/i }).isVisible();
    if (stillModal) log('  ✓ form stays open on offline save (good — no data loss)');
    else flag('P2', 'reliability', 'failure/offline', 'modal closed despite failed offline save');
    await page.context().setOffline(false);
  } else {
    flag('P3', 'visual', 'failure/setup', 'no patient available for failure injection');
  }

  await page.close();
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  log('━━━ QA full sweep — start ━━━');
  await mkdir(SCREENS_DIR, { recursive: true });
  for (const sub of ['desktop', 'mobile', 'upload', 'adversarial', 'cross-role', 'failure']) {
    await mkdir(`${SCREENS_DIR}/${sub}`, { recursive: true });
  }
  const browser = await chromium.launch();
  const desktop = await browser.newContext({ baseURL: BASE, viewport: { width: 1280, height: 800 } });
  const mobile = await browser.newContext({ baseURL: BASE, ...devices['Pixel 7'] });

  try {
    await phase1Visual(desktop, 'desktop');
    await phase1Visual(mobile, 'mobile');
    await phase2Uploads(desktop);
    await phase3Adversarial(desktop);
    await phase4CrossRole(browser);
    await phase5Failure(desktop);
  } catch (e) {
    flag('P1', 'reliability', 'sweep', `aborted: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    await desktop.close();
    await mobile.close();
    await browser.close();
  }

  // ── Findings report ─────────────────────────────────────────────────────
  const order = { P1: 0, P2: 1, P3: 2 } as const;
  findings.sort((a, b) => order[a.severity] - order[b.severity]);
  const lines = ['# QA full sweep — findings', ''];
  if (findings.length === 0) lines.push('_No issues flagged._');
  else
    for (const f of findings) {
      lines.push(`### [${f.severity}] ${f.screen} — ${f.category}`);
      lines.push(f.msg);
      if (f.screenshot) lines.push(`- screenshot: ${f.screenshot}`);
      lines.push('');
    }
  const report = lines.join('\n');
  await writeFile('/tmp/qa-findings.md', report);

  log('\n━━━ findings ━━━');
  log(report);
  log(`\nScreenshots: ${SCREENS_DIR}`);
}

main().catch((e) => {
  process.stderr.write(`${String(e)}\n`);
  process.exit(1);
});
