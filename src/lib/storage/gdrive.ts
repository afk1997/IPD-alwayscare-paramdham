import { Readable } from 'node:stream';
import { type drive_v3, google } from 'googleapis';
import pRetry from 'p-retry';
import type { FileStorage, PutResult } from './index';

const PREFIX = 'gdrive:';

// `supportsAllDrives` lets the call work on both My Drive and Shared Drive
// folders without us needing to know which kind we're hitting.
const SHARED = { supportsAllDrives: true } as const;

export class GoogleDriveStorage implements FileStorage {
  private driveClient: drive_v3.Drive | null = null;

  constructor(
    private readonly serviceAccountJson: string,
    private readonly rootFolderId: string,
  ) {
    if (!serviceAccountJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is required');
    if (!rootFolderId) throw new Error('GOOGLE_DRIVE_FOLDER_ID is required');
  }

  private drive(): drive_v3.Drive {
    if (this.driveClient) return this.driveClient;
    const credentials = JSON.parse(Buffer.from(this.serviceAccountJson, 'base64').toString('utf-8'));
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
    this.driveClient = google.drive({ version: 'v3', auth });
    return this.driveClient;
  }

  async put(buf: Buffer, meta: { filename: string; mime: string }): Promise<PutResult> {
    const drive = this.drive();
    const result = await pRetry(
      async () => {
        const res = await drive.files.create({
          ...SHARED,
          requestBody: {
            name: meta.filename,
            parents: [this.rootFolderId],
          },
          media: {
            mimeType: meta.mime,
            body: Readable.from(buf),
          },
          fields: 'id, size',
        });
        return res.data;
      },
      { retries: 3, factor: 2, minTimeout: 400 },
    );
    if (!result.id) throw new Error('Drive upload returned no file id');
    return { key: `${PREFIX}${result.id}`, size: Number(result.size ?? buf.byteLength) };
  }

  async get(key: string): Promise<{ stream: NodeJS.ReadableStream; mime: string; size: number }> {
    if (!key.startsWith(PREFIX)) throw new Error(`Invalid gdrive key: ${key}`);
    const fileId = key.slice(PREFIX.length);
    const drive = this.drive();
    const meta = await drive.files.get({ ...SHARED, fileId, fields: 'mimeType, size' });
    const dataRes = await drive.files.get({ ...SHARED, fileId, alt: 'media' }, { responseType: 'stream' });
    return {
      stream: dataRes.data as unknown as NodeJS.ReadableStream,
      mime: meta.data.mimeType ?? 'application/octet-stream',
      size: Number(meta.data.size ?? 0),
    };
  }

  async delete(key: string): Promise<void> {
    if (!key.startsWith(PREFIX)) return;
    const fileId = key.slice(PREFIX.length);
    // Move to trash rather than permanent-delete — service accounts on
    // shared drives don't always have the `delete` capability but can trash.
    await this.drive().files.update({
      ...SHARED,
      fileId,
      requestBody: { trashed: true },
    });
  }

  directUrl(): string | null {
    return null;
  }
}
