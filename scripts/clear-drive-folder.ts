/**
 * Trash every direct child of the Google Drive root folder (configured
 * via `GOOGLE_DRIVE_FOLDER_ID`).  Used to clean up dummy data created
 * during development before going to production.
 *
 * Trash, not permanent delete — files remain recoverable from Drive's
 * trash for 30 days.  The service-account user owns them, so they
 * count against the SA's trash quota.
 */
import { google } from 'googleapis';

const SHARED = { supportsAllDrives: true } as const;

async function main() {
  const rootId = process.env.GOOGLE_DRIVE_FOLDER_ID ?? process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
  const keyB64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY ?? process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!rootId) {
    process.stderr.write('GOOGLE_DRIVE_FOLDER_ID is not set\n');
    process.exit(1);
  }
  if (!keyB64) {
    process.stderr.write('GOOGLE_SERVICE_ACCOUNT_KEY is not set\n');
    process.exit(1);
  }

  // STO-4: hard guards to stop a runaway destructive operation.
  if (process.env.NODE_ENV === 'production' && process.env.I_KNOW_WHAT_IM_DOING !== 'yes') {
    process.stderr.write('Refusing to run in NODE_ENV=production without I_KNOW_WHAT_IM_DOING=yes\n');
    process.exit(1);
  }
  const confirmRoot = process.argv
    .slice(2)
    .find((a) => a.startsWith('--confirm='))
    ?.slice('--confirm='.length);
  if (confirmRoot !== rootId) {
    process.stderr.write(
      `Refusing to clear: pass --confirm=<rootFolderId> to acknowledge.\n  Target root: ${rootId}\n  Re-run with --confirm=<that exact id> if you really want to trash every direct child.\n`,
    );
    process.exit(1);
  }
  process.stdout.write(`Will trash children of ${rootId}. Starting in 5s… (Ctrl+C to abort)\n`);
  await new Promise((r) => setTimeout(r, 5_000));

  const creds = JSON.parse(Buffer.from(keyB64, 'base64').toString('utf-8'));
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });
  const drive = google.drive({ version: 'v3', auth });

  process.stdout.write(`Listing children of ${rootId} …\n`);
  const children: Array<{ id: string; name: string; mimeType: string }> = [];
  let pageToken: string | undefined;
  do {
    const res = await drive.files.list({
      ...SHARED,
      q: `'${rootId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType)',
      pageSize: 200,
      includeItemsFromAllDrives: true,
      ...(pageToken ? { pageToken } : {}),
    });
    for (const f of res.data.files ?? []) {
      if (f.id && f.name && f.mimeType) children.push({ id: f.id, name: f.name, mimeType: f.mimeType });
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  process.stdout.write(`Found ${children.length} children to trash.\n`);
  for (const c of children) {
    const tag = c.mimeType === 'application/vnd.google-apps.folder' ? '📁' : '📄';
    try {
      await drive.files.update({
        ...SHARED,
        fileId: c.id,
        requestBody: { trashed: true },
      });
      process.stdout.write(`  ${tag} trashed ${c.name} (${c.id.slice(0, 8)}…)\n`);
    } catch (e) {
      process.stdout.write(`  ✗ failed to trash ${c.name}: ${e instanceof Error ? e.message : String(e)}\n`);
    }
  }

  process.stdout.write(`\nDone. ${children.length} item(s) sent to Drive trash.\n`);
}

main().catch((e) => {
  process.stderr.write(`${String(e)}\n`);
  process.exit(1);
});
