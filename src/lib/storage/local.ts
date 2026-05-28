import { randomUUID } from 'node:crypto';
import { createReadStream, statSync } from 'node:fs';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import type { FileStorage, PutResult } from './index';

const PREFIX = 'local:';

export class LocalDiskStorage implements FileStorage {
  private readonly normalisedRoot: string;
  constructor(private readonly root: string) {
    this.normalisedRoot = resolve(this.root);
  }

  private absolute(rel: string): string {
    const abs = resolve(this.normalisedRoot, rel);
    // STO-9: assert the resolved path stays inside the configured root.
    // Without this, a crafted storage key like 'local:../../etc/passwd'
    // would escape to anywhere the process can read.
    if (abs !== this.normalisedRoot && !abs.startsWith(this.normalisedRoot + sep)) {
      throw new Error(`storage key escapes root: ${rel}`);
    }
    return abs;
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

  async getStreamOnly(key: string): Promise<{ stream: NodeJS.ReadableStream }> {
    const abs = this.fromKey(key);
    statSync(abs);
    const stream = createReadStream(abs);
    return { stream };
  }

  async delete(key: string): Promise<void> {
    const abs = this.fromKey(key);
    await unlink(abs);
  }

  directUrl(): string | null {
    return null;
  }
}
