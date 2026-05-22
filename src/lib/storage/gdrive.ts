import { Readable } from 'node:stream';
import { type drive_v3, google } from 'googleapis';
import pRetry from 'p-retry';
import type { FileStorage, PutResult } from './index';

const PREFIX = 'gdrive:';

const FOLDER_MIME = 'application/vnd.google-apps.folder';
// `supportsAllDrives` lets the call work on both My Drive and Shared Drive
// folders without us needing to know which kind we're hitting.
const SHARED = { supportsAllDrives: true } as const;

export interface InitiateResumableResult {
  uploadUrl: string;
}

export interface DriveMetadata {
  size?: number | null;
  mimeType?: string | null;
  parents?: string[] | null;
  imageMediaMetadata?: { width?: number | null; height?: number | null } | null;
  videoMediaMetadata?: { durationMillis?: string | null } | null;
}

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
}

export class GoogleDriveStorage implements FileStorage {
  private driveClient: drive_v3.Drive | null = null;
  private accessTokenCache: { token: string; expiresAt: number } | null = null;
  private readonly creds: ServiceAccountKey;

  constructor(
    serviceAccountJson: string,
    private readonly rootFolderId: string,
  ) {
    if (!serviceAccountJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is required');
    if (!rootFolderId) throw new Error('GOOGLE_DRIVE_FOLDER_ID is required');
    // STO-5: redacted error path — never include any fragment of the
    // (possibly half-decoded) key material in the surfaced exception.
    let parsed: unknown;
    try {
      const decoded = Buffer.from(serviceAccountJson, 'base64').toString('utf-8');
      parsed = JSON.parse(decoded);
    } catch {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not valid base64-encoded JSON');
    }
    this.creds = parsed as ServiceAccountKey;
    if (!this.creds.client_email || !this.creds.private_key) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY missing client_email or private_key');
    }
  }

  get rootId(): string {
    return this.rootFolderId;
  }

  private drive(): drive_v3.Drive {
    if (this.driveClient) return this.driveClient;
    const auth = new google.auth.GoogleAuth({
      credentials: this.creds as unknown as Record<string, unknown>,
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });
    this.driveClient = google.drive({ version: 'v3', auth });
    return this.driveClient;
  }

  private async accessToken(): Promise<string> {
    const now = Date.now();
    if (this.accessTokenCache && this.accessTokenCache.expiresAt > now + 60_000) {
      return this.accessTokenCache.token;
    }
    const jwt = new google.auth.JWT({
      email: this.creds.client_email,
      key: this.creds.private_key,
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });
    const { access_token, expiry_date } = await jwt.authorize();
    if (!access_token) throw new Error('Drive token exchange returned no access_token');
    this.accessTokenCache = {
      token: access_token,
      expiresAt: typeof expiry_date === 'number' ? expiry_date : now + 50 * 60_000,
    };
    return access_token;
  }

  // ── Folder ops ────────────────────────────────────────────────────────────
  async ensureFolder(parentId: string, name: string): Promise<string> {
    const drive = this.drive();
    // STO-7: escape both `\` and `'` for the Drive Files: list query
    // grammar. Backslash must be escaped first or it eats the quote.
    const escName = name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const existing = await drive.files.list({
      ...SHARED,
      q: `name = '${escName}' and mimeType = '${FOLDER_MIME}' and trashed = false and '${parentId}' in parents`,
      fields: 'files(id)',
      pageSize: 1,
      includeItemsFromAllDrives: true,
    });
    const first = existing.data.files?.[0]?.id;
    if (first) return first;
    const created = await drive.files.create({
      ...SHARED,
      requestBody: { name, mimeType: FOLDER_MIME, parents: [parentId] },
      fields: 'id',
    });
    if (!created.data.id) throw new Error('Drive folder create returned no id');
    return created.data.id;
  }

  // ── Put / get / delete ────────────────────────────────────────────────────
  async put(buf: Buffer, meta: { filename: string; mime: string; parentId?: string }): Promise<PutResult> {
    const drive = this.drive();
    const parents = [meta.parentId ?? this.rootFolderId];
    // STO-6: don't amplify 429s. Only retry on transient (5xx/connection)
    // errors; do not auto-retry on 4xx other than 429-with-Retry-After.
    const result = await pRetry(
      async () => {
        const res = await drive.files.create({
          ...SHARED,
          requestBody: { name: meta.filename, parents },
          media: { mimeType: meta.mime, body: Readable.from(buf) },
          fields: 'id, size',
        });
        return res.data;
      },
      {
        retries: 2,
        factor: 2,
        minTimeout: 400,
        randomize: true,
        shouldRetry: (err) => {
          const status =
            (err as { code?: number; status?: number })?.code ?? (err as { status?: number })?.status;
          if (typeof status !== 'number') return true; // transport-level errors → retry
          if (status >= 500) return true;
          return status === 429;
        },
      },
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
    await this.drive().files.update({
      ...SHARED,
      fileId,
      requestBody: { trashed: true },
    });
  }

  directUrl(): string | null {
    return null;
  }

  // ── Resumable upload ──────────────────────────────────────────────────────
  async initiateResumable(meta: {
    filename: string;
    mime: string;
    size: number;
    parentId: string;
    // The browser's origin — required so Drive returns a CORS-friendly
    // upload URL that the browser can PUT chunks to directly.
    origin: string;
  }): Promise<InitiateResumableResult> {
    const token = await this.accessToken();
    const url =
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true';
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': meta.mime,
        'X-Upload-Content-Length': String(meta.size),
        Origin: meta.origin,
      },
      body: JSON.stringify({ name: meta.filename, parents: [meta.parentId] }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Drive resumable init failed: ${res.status} ${body}`);
    }
    const uploadUrl = res.headers.get('location');
    if (!uploadUrl) throw new Error('Drive resumable init returned no Location header');
    return { uploadUrl };
  }

  async getFileMetadata(fileId: string): Promise<DriveMetadata> {
    const drive = this.drive();
    const res = await drive.files.get({
      ...SHARED,
      fileId,
      fields:
        'size, mimeType, parents, imageMediaMetadata(width, height), videoMediaMetadata(durationMillis)',
    });
    return res.data as DriveMetadata;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  async rename(key: string, newName: string): Promise<void> {
    if (!key.startsWith(PREFIX)) return;
    const fileId = key.slice(PREFIX.length);
    await this.drive().files.update({
      ...SHARED,
      fileId,
      requestBody: { name: newName },
    });
  }

  async move(key: string, fromParentId: string, toParentId: string): Promise<void> {
    if (!key.startsWith(PREFIX)) return;
    const fileId = key.slice(PREFIX.length);
    await this.drive().files.update({
      ...SHARED,
      fileId,
      addParents: toParentId,
      removeParents: fromParentId,
    });
  }

  async hardDelete(key: string): Promise<void> {
    if (!key.startsWith(PREFIX)) return;
    const fileId = key.slice(PREFIX.length);
    await this.drive().files.delete({ ...SHARED, fileId });
  }
}

export function isGoogleDriveStorage(s: unknown): s is GoogleDriveStorage {
  return s instanceof GoogleDriveStorage;
}
