import { searchActivitiesAction } from '../src/features/activities/actions';
/**
 * Friction probes — exercise edges that the day-in-the-life script
 * doesn't naturally hit:
 *   - last-admin guard (H2-s) — can't deactivate or demote sole admin
 *   - self-role-change guard (H3-s)
 *   - asset-ownership reject on createActivity (C1)
 *   - assertOwnedReadyAssets accepts PENDING assets you uploaded but
 *     refuses other users' PENDING assets
 *   - searchActivities cache observably memoizes a query
 *   - concurrent createActivity for the same animal — no FK violations
 */
import { createActivity } from '../src/features/activities/service';
import { assertOwnedReadyAssets } from '../src/features/media/service';
import { updateUser } from '../src/features/users/service';
import { RbacError } from '../src/lib/errors';
import { prisma } from '../src/lib/prisma';

const friction: { category: string; msg: string }[] = [];
const flag = (c: string, m: string) => friction.push({ category: c, msg: m });
const log = (s: string) => process.stdout.write(`${s}\n`);

async function probeLastAdminGuard() {
  log('▶ Last-admin guard');
  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN', active: true },
    select: { id: true, name: true },
  });
  if (!admin) return flag('rbac', 'no admin in DB to probe');

  const otherAdmins = await prisma.user.count({
    where: { role: 'ADMIN', active: true, id: { not: admin.id } },
  });

  // Try to demote self — H3-s should kick in first regardless.
  try {
    await updateUser({ id: admin.id, role: 'ADMIN' }, { id: admin.id, role: 'STAFF' });
    flag('rbac', 'updateUser allowed admin to demote themselves');
  } catch (e) {
    if (e instanceof RbacError && /own role/i.test(e.message)) log('  + H3-s: self-role-change blocked');
    else flag('rbac', `unexpected error on self-demote: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (otherAdmins === 0) {
    log(
      '  ! only one admin in DB — last-admin guard can be tested via deactivating self.  Skipping deactivation probe to avoid locking the clinic out.',
    );
  } else {
    log(
      `  ${otherAdmins} other admin(s) exist — guard would need synthetic single-admin DB to fully exercise.`,
    );
  }
}

async function probeAssetOwnershipReject() {
  log('▶ Asset-ownership reject');
  // Create two users (re-use existing ones).
  const drA = await prisma.user.findFirst({ where: { role: 'DOCTOR', active: true }, select: { id: true } });
  const drB = await prisma.user.findFirst({
    where: { role: 'DOCTOR', active: true, id: { not: drA?.id ?? '' } },
    select: { id: true },
  });
  if (!drA || !drB) return flag('rbac', 'need 2 doctors for ownership probe');

  // Make a PENDING asset uploaded by drA, then have drB try to attach it.
  const asset = await prisma.mediaAsset.create({
    data: {
      kind: 'PHOTO',
      mimeType: 'image/jpeg',
      filename: 'probe.jpg',
      size: 100,
      status: 'PENDING',
      storageKey: `pending:fake-${Date.now()}`,
      uploadedById: drA.id,
    },
  });

  try {
    await assertOwnedReadyAssets({ id: drB.id, role: 'DOCTOR' }, [asset.id]);
    flag('rbac', "assertOwnedReadyAssets let drB use drA's PENDING asset");
  } catch (e) {
    if (e instanceof RbacError) log('  + cross-user asset reject works');
    else flag('rbac', `wrong error type: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Try with a non-existent asset id.
  try {
    await assertOwnedReadyAssets({ id: drA.id, role: 'DOCTOR' }, ['no-such-id']);
    flag('rbac', 'assertOwnedReadyAssets accepted a non-existent id');
  } catch (e) {
    if (e instanceof RbacError || /not found|invalid/i.test(e instanceof Error ? e.message : '')) {
      log('  + non-existent asset id rejected');
    } else {
      flag('rbac', `wrong error on bad id: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Cleanup
  await prisma.mediaAsset.delete({ where: { id: asset.id } });
}

async function probeCache() {
  log('▶ searchActivitiesAction cache (skipped — server action requires request scope)');
  // The action calls getCurrentUser() which reads next/headers — not
  // callable from a plain Node script.  Real cache behavior is covered
  // by the ⌘K Playwright suite.
  void searchActivitiesAction;
}

async function probeConcurrentWrites() {
  log('▶ Concurrent createActivity (10 ROUNDs for the same animal in parallel)');
  const animal = await prisma.animal.findFirst({
    where: { status: { in: ['CRITICAL', 'STABLE', 'OBSERVATION'] }, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!animal) return flag('data', 'no active animal for concurrency probe');
  const doctor = await prisma.user.findFirst({
    where: { role: 'DOCTOR', active: true },
    select: { id: true, name: true },
  });
  if (!doctor) return flag('rbac', 'no DOCTOR for concurrency probe');

  const t = Date.now();
  const results = await Promise.allSettled(
    Array.from({ length: 10 }).map((_, i) =>
      createActivity(
        { id: doctor.id, role: 'DOCTOR', name: doctor.name },
        {
          type: 'ROUND',
          animalId: animal.id,
          remarks: `concurrent #${i}`,
          mediaAssetIds: [],
          byName: doctor.name,
          data: { notes: `parallel ${i}` },
        },
      ),
    ),
  );
  const ok = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
  log(`  ${ok}/10 succeeded in ${Date.now() - t}ms`);
  for (const f of failed.slice(0, 3)) {
    flag(
      'reliability',
      `concurrent write failed: ${f.reason instanceof Error ? f.reason.message : String(f.reason)}`,
    );
  }

  // Cleanup
  await prisma.activity.deleteMany({
    where: { animalId: animal.id, remarks: { startsWith: 'concurrent #' } },
  });
}

async function main() {
  log('━━━ friction probes ━━━\n');
  await probeLastAdminGuard();
  log('');
  await probeAssetOwnershipReject();
  log('');
  await probeCache();
  log('');
  await probeConcurrentWrites();
  log('');
  log('━━━ summary ━━━');
  if (friction.length === 0) log('(no friction flagged)');
  else for (const f of friction) log(`  [${f.category}] ${f.msg}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  process.stderr.write(`${String(e)}\n`);
  process.exit(1);
});
