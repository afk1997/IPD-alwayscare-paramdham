import { google } from 'googleapis';

async function main() {
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY ?? '';
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID ?? '';
  if (!key || !folderId) throw new Error('missing env');

  const credentials = JSON.parse(Buffer.from(key, 'base64').toString('utf-8'));
  process.stdout.write(`Service account: ${credentials.client_email}\n`);
  process.stdout.write(`Target folder:   ${folderId}\n\n`);

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  const drive = google.drive({ version: 'v3', auth });

  process.stdout.write('1) Listing folders the service account can see…\n');
  const list = await drive.files.list({
    q: "mimeType = 'application/vnd.google-apps.folder' and trashed = false",
    fields: 'files(id, name, owners(emailAddress))',
    pageSize: 25,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const folders = list.data.files ?? [];
  if (folders.length === 0) {
    process.stdout.write('   (none) — service account has no folder access\n');
  } else {
    for (const f of folders) process.stdout.write(`   - ${f.id}  ${f.name}\n`);
  }

  process.stdout.write('\n2) Trying to get the target folder by ID…\n');
  try {
    const got = await drive.files.get({
      fileId: folderId,
      fields: 'id, name, mimeType, owners(emailAddress)',
      supportsAllDrives: true,
    });
    process.stdout.write(`   FOUND: ${got.data.name} (${got.data.mimeType})\n`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    process.stdout.write(`   FAILED: ${msg}\n`);
  }
}

main().catch((e) => {
  process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
