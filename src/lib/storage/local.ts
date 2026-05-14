import { randomUUID } from 'node:crypto';
import { createReadStream, statSync } from 'node:fs';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import type { FileStorage, PutResult } from './index';

const PREFIX = 'local:';

export class LocalDiskStorage implements FileStorage {
  constructor(private readonly root: string) {}

  private absolute(rel: string): string {
    return resolve(this.root, rel);
  }

  private fromKey(key: string): string {
    if (!key.startsWith(PREFIX)) throw new Error(`Invalid local key: ${key}`);
    return this.absolute(key.slice(PREFIX.length));
  }

  async put(buf: Buffer, meta: { filename: string; mime: string }): Promise<PutResult> {
    const yyyymm = new Date().toISOString().slice(0, 7);
    const ext = extname(meta.filename) || '';
    const rel = `${yyyymm}/${randomUUID()}${ext}`;
    const abs = this.absolute(rel);
    await mkdir(join(abs, '..'), { recursive: true });
    await writeFile(abs, buf);
    return { key: `${PREFIX}${rel}`, size: buf.byteLength };
  }

  async get(key: string): Promise<{ stream: NodeJS.ReadableStream; mime: string; size: number }> {
    const abs = this.fromKey(key);
    const stats = statSync(abs);
    return { stream: createReadStream(abs), mime: 'application/octet-stream', size: stats.size };
  }

  async delete(key: string): Promise<void> {
    const abs = this.fromKey(key);
    await unlink(abs);
  }

  directUrl(): string | null {
    return null;
  }
}
