import { prisma } from '@/lib/prisma';
import { getStorage } from '@/lib/storage';
import { isGoogleDriveStorage } from '@/lib/storage/gdrive';

const STAGING_NAME = '_staging';
const ADMISSION_NAME = 'admission';
const DELETED_PREFIX = '[DELETED] ';

export type ActivityFolderType =
  | 'admission'
  | 'treatment'
  | 'round'
  | 'diagnostic'
  | 'surgery'
  | 'food'
  | 'bath'
  | 'walk';

/** Map Prisma ActivityType -> the folder slug used on Drive. */
export function activityFolderName(type: string): ActivityFolderType {
  return type.toLowerCase() as ActivityFolderType;
}

/** Sanitise a name for use as a Drive folder name. */
function sanitize(s: string): string {
  return s.replace(/[\\/<>:"|?*]/g, '_').trim();
}

function animalFolderName(animal: { id: string; name: string }): string {
  const suffix = animal.id.slice(-6);
  return `${sanitize(animal.name)} (#${suffix})`;
}

// FNV-1a 64-bit → bigint in the signed-64 range so it can be used with
// Postgres `pg_advisory_xact_lock(bigint)`.
function stringToInt64(s: string): bigint {
  let h = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const MASK = 0xffffffffffffffffn;
  const SIGNED_MAX = 0x7fffffffffffffffn;
  const TWO_POW_64 = 0x10000000000000000n;
  for (let i = 0; i < s.length; i++) {
    h = ((h ^ BigInt(s.charCodeAt(i))) * prime) & MASK;
  }
  return h > SIGNED_MAX ? h - TWO_POW_64 : h;
}

interface FolderResolver {
  /** Folder where admission files live (after admission). */
  admissionFolder(animal: { id: string; name: string }): Promise<string>;
  /** Folder used to stage uploads before the animal exists yet. */
  stagingFolder(sessionId: string): Promise<string>;
  /** Folder for a specific activity entry (animal/YYYY-MM/DD/type). */
  activityFolder(animal: { id: string; name: string }, occurredAt: Date, type: string): Promise<string>;
  /** Folder for an animal's documents grouped by category. */
  documentFolder(animal: { id: string; name: string }, category: string): Promise<string>;
  /** The root Drive folder id. */
  rootFolderId(): string;
  /** Move every Drive file from one parent to another (when admit completes). */
  movePending(fromParentId: string, toParentId: string, keys: string[]): Promise<void>;
  /** Mark a file as deleted by renaming with the [DELETED] prefix. */
  markDeleted(key: string, currentName: string): Promise<string>;
  /** Reverse markDeleted. */
  unmarkDeleted(key: string, currentName: string): Promise<string>;
  /** Permanently remove a file from Drive. */
  hardDelete(key: string): Promise<void>;
}

class NullResolver implements FolderResolver {
  private storage = getStorage();
  private noFolders(): never {
    throw new Error('folder operations require STORAGE_DRIVER=gdrive');
  }
  async admissionFolder(): Promise<string> {
    return this.noFolders();
  }
  async stagingFolder(): Promise<string> {
    return this.noFolders();
  }
  async activityFolder(): Promise<string> {
    return this.noFolders();
  }
  async documentFolder(): Promise<string> {
    return this.noFolders();
  }
  rootFolderId() {
    return '';
  }
  async movePending() {
    /* no-op for local */
  }
  async markDeleted(_key: string, name: string): Promise<string> {
    return `${DELETED_PREFIX}${name}`;
  }
  async unmarkDeleted(_key: string, name: string): Promise<string> {
    return name.startsWith(DELETED_PREFIX) ? name.slice(DELETED_PREFIX.length) : name;
  }
  async hardDelete(key: string) {
    await this.storage.delete(key);
  }
}

class DriveResolver implements FolderResolver {
  constructor(
    private readonly storage = getStorage(),
    private readonly drive = (() => {
      const s = getStorage();
      if (!isGoogleDriveStorage(s)) throw new Error('DriveResolver requires gdrive storage');
      return s;
    })(),
  ) {}

  rootFolderId(): string {
    return this.drive.rootId;
  }

  private async resolve(key: string, factory: () => Promise<string>): Promise<string> {
    // Fast path: cached row.
    const cached = await prisma.driveFolder.findUnique({ where: { key } });
    if (cached) return cached.driveFolderId;

    // Slow path: serialize on a Postgres advisory lock keyed by the folder
    // key so two concurrent requests can't both `files.create` on Drive
    // and end up with duplicate folders.  We hold the lock across a network
    // call to the Drive API (folder create), so bump the Prisma transaction
    // timeout well past Drive's worst-case latency (~3-8 s).
    const lockId = stringToInt64(key);
    return prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId}::bigint)`;
        const existing = await tx.driveFolder.findUnique({ where: { key } });
        if (existing) return existing.driveFolderId;
        const id = await factory();
        await tx.driveFolder.create({ data: { key, driveFolderId: id } });
        return id;
      },
      { timeout: 30_000, maxWait: 5_000 },
    );
  }

  async stagingFolder(sessionId: string): Promise<string> {
    return this.resolve(`staging:${sessionId}`, async () => {
      const root = this.drive.rootId;
      const staging = await this.drive.ensureFolder(root, STAGING_NAME);
      return this.drive.ensureFolder(staging, sessionId);
    });
  }

  private async animalRoot(animal: { id: string; name: string }): Promise<string> {
    return this.resolve(`animal:${animal.id}`, async () =>
      this.drive.ensureFolder(this.drive.rootId, animalFolderName(animal)),
    );
  }

  async admissionFolder(animal: { id: string; name: string }): Promise<string> {
    return this.resolve(`admission:${animal.id}`, async () => {
      const root = await this.animalRoot(animal);
      return this.drive.ensureFolder(root, ADMISSION_NAME);
    });
  }

  async activityFolder(
    animal: { id: string; name: string },
    occurredAt: Date,
    type: string,
  ): Promise<string> {
    const ym = occurredAt.toISOString().slice(0, 7); // YYYY-MM
    const dd = String(occurredAt.getUTCDate()).padStart(2, '0');
    const slug = activityFolderName(type);
    return this.resolve(`activity:${animal.id}:${ym}:${dd}:${slug}`, async () => {
      const animalRoot = await this.animalRoot(animal);
      const monthId = await this.drive.ensureFolder(animalRoot, ym);
      const dayId = await this.drive.ensureFolder(monthId, dd);
      return this.drive.ensureFolder(dayId, slug);
    });
  }

  async documentFolder(animal: { id: string; name: string }, category: string): Promise<string> {
    const slug = sanitize(category).toLowerCase();
    return this.resolve(`document:${animal.id}:${slug}`, async () => {
      const animalRoot = await this.animalRoot(animal);
      const docsId = await this.drive.ensureFolder(animalRoot, 'documents');
      return this.drive.ensureFolder(docsId, slug);
    });
  }

  async movePending(fromParentId: string, toParentId: string, keys: string[]): Promise<void> {
    if (!fromParentId || !toParentId || fromParentId === toParentId) return;
    await Promise.all(keys.map((k) => this.drive.move(k, fromParentId, toParentId)));
  }

  async markDeleted(key: string, currentName: string): Promise<string> {
    if (currentName.startsWith(DELETED_PREFIX)) return currentName;
    const newName = `${DELETED_PREFIX}${currentName}`;
    await this.drive.rename(key, newName);
    return newName;
  }

  async unmarkDeleted(key: string, currentName: string): Promise<string> {
    if (!currentName.startsWith(DELETED_PREFIX)) return currentName;
    const newName = currentName.slice(DELETED_PREFIX.length);
    await this.drive.rename(key, newName);
    return newName;
  }

  async hardDelete(key: string): Promise<void> {
    await this.drive.hardDelete(key);
  }
}

let cached: FolderResolver | null = null;

export function folderResolver(): FolderResolver {
  if (cached) return cached;
  const s = getStorage();
  cached = isGoogleDriveStorage(s) ? new DriveResolver(s, s) : new NullResolver();
  return cached;
}

export function resetFolderResolverForTests(): void {
  cached = null;
}
