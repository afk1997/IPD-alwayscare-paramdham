import { GoogleDriveStorage } from './gdrive';
import { LocalDiskStorage } from './local';

export interface PutResult {
  key: string;
  size: number;
  width?: number;
  height?: number;
  durationSec?: number;
}

export interface FileStorage {
  put(buf: Buffer, meta: { filename: string; mime: string }): Promise<PutResult>;
  get(key: string): Promise<{ stream: NodeJS.ReadableStream; mime: string; size: number }>;
  delete(key: string): Promise<void>;
  directUrl(key: string): string | null;
}

let cached: FileStorage | null = null;

export function getStorage(): FileStorage {
  if (cached) return cached;
  const driver = process.env.STORAGE_DRIVER ?? 'local';
  if (driver === 'local') {
    cached = new LocalDiskStorage(process.env.LOCAL_UPLOAD_DIR ?? './uploads');
    return cached;
  }
  if (driver === 'gdrive') {
    const key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY ?? process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? '';
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID ?? process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID ?? '';
    cached = new GoogleDriveStorage(key, folderId);
    return cached;
  }
  throw new Error(`Unsupported STORAGE_DRIVER: ${driver}`);
}

export function resetStorageForTests(): void {
  cached = null;
}
