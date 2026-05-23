/**
 * Purge every QA test fixture from Neon + Drive.
 *
 * Convention: every entity created by the QA campaign carries the
 * literal string `__qa__` in its name / remarks / context.  This script
 * scans every table for that marker and trashes the matching rows; the
 * Drive trash pass then targets folders whose name begins with `__qa__`.
 *
 * Usage:
 *   pnpm exec dotenv -e .env.local -- tsx scripts/cleanup-qa-data.ts --dry-run
 *   pnpm exec dotenv -e .env.local -- tsx scripts/cleanup-qa-data.ts --confirm
 *
 * The --confirm flag is mandatory in non-dry-run mode so a stray
 * invocation doesn't blow data away.
 */
import { PrismaClient } from '@prisma/client';
import { google } from 'googleapis';

const MARK = '__qa__';

function log(msg: string) {
  process.stdout.write(`${msg}\n`);
}

async function cleanupDb(dryRun: boolean) {
  const prisma = new PrismaClient();
  try {
    // ---- Find ----
    const [animals, activities, documents, mediaAssets] = await Promise.all([
      prisma.animal.findMany({
        where: { name: { contains: MARK } },
        select: { id: true, name: true },
      }),
      prisma.activity.findMany({
        where: {
          OR: [
            { remarks: { contains: MARK } },
            { byName: { contains: MARK } },
            { animal: { name: { contains: MARK } } },
          ],
        },
        select: { id: true, type: true, animalId: true },
      }),
      prisma.document.findMany({
        where: {
          OR: [
            { name: { contains: MARK } },
            { kind: { contains: MARK } },
            { animal: { name: { contains: MARK } } },
          ],
        },
        select: { id: true, name: true, fileId: true },
      }),
      prisma.mediaAsset.findMany({
        where: {
          OR: [{ filename: { contains: MARK } }, { originalFilename: { contains: MARK } }],
        },
        select: { id: true, filename: true, storageKey: true },
      }),
    ]);

    log(
      `DB scan: ${animals.length} animals, ${activities.length} activities, ${documents.length} documents, ${mediaAssets.length} media assets carry __qa__`,
    );

    if (dryRun) {
      for (const a of animals.slice(0, 5)) log(`  animal ${a.id} ${a.name}`);
      for (const x of activities.slice(0, 5)) log(`  activity ${x.id} ${x.type}`);
      for (const d of documents.slice(0, 5)) log(`  document ${d.id} ${d.name}`);
      log('[dry-run] no rows deleted');
      return { animals, activities, documents, mediaAssets };
    }

    // ---- Delete (order matters: leaf rows first to avoid FK conflicts) ----
    // ActivityMedia + AnimalMedia + Document FKs all cascade from Activity /
    // Animal / MediaAsset, so deleting parents removes them too. But to be
    // safe we also clear MediaAsset rows whose join rows we no longer need.

    // 1. Audit log rows referencing __qa__ entities — clear so a stale
    //    audit row doesn't dangle pointing at a deleted entity.
    const auditDeleted = await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { entityId: { in: animals.map((a) => a.id) } },
          { entityId: { in: activities.map((x) => x.id) } },
          { entityId: { in: documents.map((d) => d.id) } },
          { entityId: { in: mediaAssets.map((m) => m.id) } },
        ],
      },
    });
    log(`  ↳ audit rows: ${auditDeleted.count}`);

    // 2. Documents (will null fileId or detach).
    if (documents.length > 0) {
      const r = await prisma.document.deleteMany({
        where: { id: { in: documents.map((d) => d.id) } },
      });
      log(`  ↳ documents: ${r.count}`);
    }

    // 3. Activities (cascades ActivityMedia).
    if (activities.length > 0) {
      const r = await prisma.activity.deleteMany({
        where: { id: { in: activities.map((x) => x.id) } },
      });
      log(`  ↳ activities: ${r.count}`);
    }

    // 4. Animal records — first wipe their 1:1 lifecycle rows so the
    //    cascade can fire cleanly.
    if (animals.length > 0) {
      const animalIds = animals.map((a) => a.id);
      await prisma.dischargeRecord.deleteMany({ where: { animalId: { in: animalIds } } });
      await prisma.deathRecord.deleteMany({ where: { animalId: { in: animalIds } } });
      const r = await prisma.animal.deleteMany({ where: { id: { in: animalIds } } });
      log(`  ↳ animals: ${r.count}`);
    }

    // 5. MediaAsset rows last (now unreferenced).
    if (mediaAssets.length > 0) {
      const r = await prisma.mediaAsset.deleteMany({
        where: { id: { in: mediaAssets.map((m) => m.id) } },
      });
      log(`  ↳ media assets: ${r.count}`);
    }

    // 6. Stale DriveFolder rows for QA animals.
    const folderRows = await prisma.driveFolder.findMany({
      where: { key: { contains: MARK } },
      select: { key: true },
    });
    if (folderRows.length > 0) {
      const r = await prisma.driveFolder.deleteMany({
        where: { key: { in: folderRows.map((f) => f.key) } },
      });
      log(`  ↳ drive folder map rows: ${r.count}`);
    }

    return { animals, activities, documents, mediaAssets };
  } finally {
    await prisma.$disconnect();
  }
}

async function cleanupDrive(dryRun: boolean) {
  const keyB64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY ?? process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const rootId = process.env.GOOGLE_DRIVE_FOLDER_ID ?? process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
  if (!keyB64 || !rootId) {
    log('Drive cleanup skipped (no GOOGLE_SERVICE_ACCOUNT_KEY / GOOGLE_DRIVE_FOLDER_ID)');
    return;
  }

  const creds = JSON.parse(Buffer.from(keyB64, 'base64').toString('utf-8'));
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });
  const drive = google.drive({ version: 'v3', auth });

  const found: { id: string; name: string }[] = [];
  let pageToken: string | undefined;
  do {
    const res = await drive.files.list({
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      q: `'${rootId}' in parents and trashed = false and name contains '${MARK}'`,
      fields: 'nextPageToken, files(id, name)',
      pageSize: 200,
      ...(pageToken ? { pageToken } : {}),
    });
    for (const f of res.data.files ?? []) {
      if (f.id && f.name) found.push({ id: f.id, name: f.name });
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  log(`Drive scan: ${found.length} __qa__ children of root ${rootId}`);
  if (dryRun) {
    for (const f of found.slice(0, 5)) log(`  ${f.name} (${f.id.slice(0, 8)}…)`);
    log('[dry-run] no Drive items trashed');
    return;
  }

  let trashed = 0;
  for (const f of found) {
    try {
      await drive.files.update({
        supportsAllDrives: true,
        fileId: f.id,
        requestBody: { trashed: true },
      });
      trashed += 1;
    } catch (e) {
      log(`  ✗ ${f.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  log(`  ↳ Drive items trashed: ${trashed}`);
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const confirm = args.includes('--confirm');
  if (!dryRun && !confirm) {
    log('Refusing to run: pass --dry-run to preview, or --confirm to actually delete.');
    process.exit(1);
  }

  log(`Mode: ${dryRun ? 'DRY-RUN' : 'DELETE'}`);
  await cleanupDb(dryRun);
  await cleanupDrive(dryRun);
  log('Done.');
}

main().catch((e) => {
  process.stderr.write(`${String(e)}\n`);
  process.exit(1);
});
