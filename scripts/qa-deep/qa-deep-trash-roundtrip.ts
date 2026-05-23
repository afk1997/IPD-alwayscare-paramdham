/**
 * The user's flagged scenario: an activity is deleted, an admin opens
 * Trash, hits Restore, and the activity is back.
 *
 * Steps:
 *   1. Login as admin.
 *   2. Admit a __qa__-prefixed animal (so cleanup-qa-data.ts can purge it).
 *   3. Log a FOOD activity on it.
 *   4. Open the patient detail page, click the activity in the timeline,
 *      click Delete, confirm.
 *   5. Verify the activity has vanished from the timeline.
 *   6. Navigate to /admin/trash.
 *   7. Verify the deleted activity is listed under Activities.
 *   8. Click Restore.
 *   9. Navigate back to the patient page.
 *  10. Verify the activity is back on the timeline.
 *
 * Cleanup at the end: cleanup-qa-data.ts handles it.
 */
import { endProbe, login, qaLabel, screenshot, startProbe } from './_lib';

async function main() {
  const ctx = await startProbe('qa-deep-trash-roundtrip');
  try {
    const page = await ctx.desktop.newPage();
    await login(page);

    // ---- Step 2: admit a __qa__ animal ----
    const animalName = qaLabel('TrashAnim');
    await page.goto('/patients/new');
    await page.getByLabel('Animal name / temporary ID').fill(animalName);
    await page.getByLabel('Species').selectOption('Dog');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Continue' }).click(); // Step 2 (Rescuer) - skip
    await page.getByLabel('Chief complaint').fill(`${animalName} chief complaint`);
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Continue' }).click(); // Step 4 (Media) - skip
    await page.getByRole('button', { name: 'Admit animal' }).click();
    await page.waitForURL(/\/patients\/[a-z0-9]+$/, { timeout: 30_000 });
    const detailUrl = page.url();
    await screenshot(page, ctx, '01-after-admit', 'desktop');

    // ---- Step 3: log a FOOD activity via the per-patient QuickAdd ----
    await page.getByRole('button', { name: /log activity/i }).click();
    // ActivityQuickAdd uses aria-modal div w/o role="dialog" (UI-11 a11y fix
    // pattern). Match it by aria-label instead.
    const dialog = page.locator('[aria-modal="true"]');
    await dialog.getByRole('button', { name: /food & water/i }).click();
    await dialog.getByLabel('Food type').fill('__qa__ kibble');
    await dialog.getByLabel('Quantity').fill('80g');
    await dialog.getByLabel(/^Water$/).fill('100ml');
    await dialog.getByRole('button', { name: 'Fully', exact: true }).click();
    await dialog.getByRole('button', { name: /save entry/i }).click();
    // Wait for the timeline to render the new activity.
    await page.getByText('__qa__ kibble').first().waitFor({ timeout: 15_000 });
    await screenshot(page, ctx, '02-after-log', 'desktop');

    // ---- Step 4: open ActivitySheet for that activity + delete ----
    await page.getByText('__qa__ kibble').first().click();
    // Sheet opens at the right; click Delete then Confirm
    await page.getByRole('button', { name: /^delete/i }).click();
    await screenshot(page, ctx, '03-delete-confirm', 'desktop');
    await page.getByRole('button', { name: /confirm delete|yes, delete/i }).click();

    // ---- Step 5: timeline no longer shows the activity ----
    await page.waitForTimeout(1500);
    await page.reload();
    await page.waitForLoadState('networkidle').catch(() => undefined);
    const stillThere = await page
      .getByText('__qa__ kibble')
      .first()
      .isVisible()
      .catch(() => false);
    if (stillThere) {
      await ctx.finding('critical', 'After delete + reload, activity still visible on the patient timeline');
    } else {
      process.stdout.write('  ✓ activity removed from timeline\n');
    }
    await screenshot(page, ctx, '04-after-delete', 'desktop');

    // ---- Step 6+7: open /admin/trash, find the deleted activity ----
    await page.goto('/admin/trash');
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await screenshot(page, ctx, '05-trash-activities', 'desktop');
    const trashedRow = page.getByRole('listitem').filter({ hasText: /Food/i });
    const visible = await trashedRow
      .first()
      .isVisible()
      .catch(() => false);
    if (!visible) {
      await ctx.finding('critical', 'Deleted activity not visible in /admin/trash Activities tab');
    } else {
      process.stdout.write('  ✓ activity visible in Trash\n');
    }

    // ---- Step 8: click Restore on the row ----
    await trashedRow
      .first()
      .getByRole('button', { name: /restore/i })
      .click();
    await page.waitForTimeout(2000);
    await screenshot(page, ctx, '06-after-restore', 'desktop');

    // ---- Step 9+10: navigate back and verify the activity is back ----
    await page.goto(detailUrl);
    await page.waitForLoadState('networkidle').catch(() => undefined);
    const back = await page
      .getByText('__qa__ kibble')
      .first()
      .isVisible({ timeout: 10_000 })
      .catch(() => false);
    if (!back) {
      await ctx.finding(
        'critical',
        'After clicking Restore, activity does NOT reappear on the patient timeline',
      );
    } else {
      process.stdout.write('  ✓ activity restored to timeline\n');
    }
    await screenshot(page, ctx, '07-back-on-timeline', 'desktop');

    await page.close();
  } catch (e) {
    await ctx.finding('critical', `probe threw: ${e instanceof Error ? e.message : String(e)}`);
    throw e;
  } finally {
    await endProbe(ctx);
  }
}

main().catch((e) => {
  process.stderr.write(`${String(e)}\n`);
  process.exit(1);
});
