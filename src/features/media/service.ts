import { writeAuditLog } from '@/lib/audit';
import { NotFoundError, RbacError, ValidationError } from '@/lib/errors';
import { folderResolver } from '@/lib/folders';
import { prisma } from '@/lib/prisma';
import { type Actor, assertCan, can } from '@/lib/rbac';
import { getStorage } from '@/lib/storage';
import { isGoogleDriveStorage } from '@/lib/storage/gdrive';
import type { MediaKind } from '@prisma/client';

const CLINICAL_TYPES = new Set(['ROUND', 'DIAGNOSTIC', 'SURGERY']);

export const SIZE_CAPS = {
  image: 50 * 1024 * 1024, // 50 MB
  video: 2 * 1024 * 1024 * 1024, // 2 GB
  doc: 25 * 1024 * 1024, // 25 MB
} as const;

export const CHUNK_SIZE = 8 * 1024 * 1024;

export type InitiateContext =
  | { kind: 'staging'; sessionId: string }
  | { kind: 'activity'; animalId: string; activityType: string; occurredAt: string }
  | { kind: 'document'; animalId: string; category: string };

export interface InitiateInput {
  filename: string;
  mime: string;
  size: number;
  context: InitiateContext;
  origin: string;
}

export interface InitiateResult {
  assetId: string;
  uploadUrl: string;
  chunkSize: number;
}

export async function initiateUpload(actor: Actor, input: InitiateInput): Promise<InitiateResult> {
  // RBAC. Each context kind reuses the create gate for the entity it'll
  // eventually attach to.
  if (input.context.kind === 'staging') {
    assertCan(actor, 'animal.create');
  } else if (input.context.kind === 'document') {
    assertCan(actor, 'document.create');
  } else {
    const action = CLINICAL_TYPES.has(input.context.activityType)
      ? 'activity.create.clinical'
      : 'activity.create';
    assertCan(actor, action);
  }

  const classified = classifyMedia(input.mime, input.size);
  if ('error' in classified) throw new ValidationError(classified.error);

  // Resolve folder.
  const folders = folderResolver();
  let parentId: string;
  if (input.context.kind === 'staging') {
    parentId = await folders.stagingFolder(input.context.sessionId);
  } else {
    const animal = await prisma.animal.findUnique({
      where: { id: input.context.animalId },
      select: { id: true, name: true },
    });
    if (!animal) throw new NotFoundError('Animal', input.context.animalId);
    if (input.context.kind === 'activity') {
      parentId = await folders.activityFolder(
        animal,
        new Date(input.context.occurredAt),
        input.context.activityType,
      );
    } else {
      parentId = await folders.documentFolder(animal, input.context.category);
    }
  }

  // Mint resumable session.
  const storage = getStorage();
  if (!isGoogleDriveStorage(storage)) {
    throw new ValidationError('STORAGE_DRIVER must be gdrive for the resumable upload path');
  }
  const init = await storage.initiateResumable({
    filename: input.filename,
    mime: input.mime,
    size: input.size,
    parentId,
    origin: input.origin,
  });

  // Insert the PENDING asset row.
  const asset = await prisma.mediaAsset.create({
    data: {
      kind: classified.kind,
      filename: input.filename,
      originalFilename: input.filename,
      mimeType: input.mime,
      size: input.size,
      storageKey: '',
      status: 'PENDING',
      uploadedById: actor.id,
    },
  });

  return { assetId: asset.id, uploadUrl: init.uploadUrl, chunkSize: CHUNK_SIZE };
}

export interface FinalizeInput {
  assetId: string;
  driveFileId: string;
}

export async function finalizeUpload(actor: Actor, input: FinalizeInput) {
  const asset = await prisma.mediaAsset.findUnique({ where: { id: input.assetId } });
  if (!asset) throw new NotFoundError('MediaAsset', input.assetId);
  if (asset.uploadedById !== actor.id && !can(actor, 'audit.read.all')) {
    throw new RbacError('finalize.notOwner');
  }

  const expectedKey = `gdrive:${input.driveFileId}`;

  // Idempotent: same key on a READY asset is a noop. Different key → reject.
  if (asset.status === 'READY') {
    if (asset.storageKey !== expectedKey) {
      throw new ValidationError('asset already finalized with a different file');
    }
    return asset;
  }

  const storage = getStorage();
  if (!isGoogleDriveStorage(storage)) {
    throw new ValidationError('gdrive storage required');
  }

  let width: number | null = null;
  let height: number | null = null;
  let durationSec: number | null = null;
  let size = asset.size;
  try {
    const meta = await storage.getFileMetadata(input.driveFileId);
    if (meta.imageMediaMetadata?.width) width = meta.imageMediaMetadata.width;
    if (meta.imageMediaMetadata?.height) height = meta.imageMediaMetadata.height;
    if (meta.videoMediaMetadata?.durationMillis) {
      const ms = Number(meta.videoMediaMetadata.durationMillis);
      if (Number.isFinite(ms) && ms > 0) durationSec = Math.round(ms / 1000);
    }
    if (meta.size) {
      const sz = Number(meta.size);
      if (Number.isFinite(sz) && sz > 0) size = sz;
    }
  } catch {
    // Best-effort metadata; the file is still usable without it.
  }

  return prisma.mediaAsset.update({
    where: { id: input.assetId },
    data: {
      storageKey: expectedKey,
      status: 'READY',
      size,
      width,
      height,
      durationSec,
    },
  });
}

export interface MediaForRead {
  id: string;
  status: 'PENDING' | 'READY' | 'FAILED';
  storageKey: string;
  mimeType: string;
  size: number;
}

/** Look up a media asset for read; throws if the user can't access it. */
export async function getMediaForRead(actor: Actor, assetId: string): Promise<MediaForRead> {
  const asset = await prisma.mediaAsset.findUnique({
    where: { id: assetId },
    select: { id: true, status: true, storageKey: true, mimeType: true, size: true },
  });
  if (!asset) throw new NotFoundError('MediaAsset', assetId);
  // All authenticated users can read; row-level access is enforced by the
  // owning Activity / Animal / Document layer downstream.
  void actor;
  return asset;
}

export interface ClassifiedMedia {
  kind: MediaKind;
}
export type Classify = ClassifiedMedia | { error: string };

export function classifyMedia(mime: string, size: number): Classify {
  if (mime.startsWith('image/')) {
    if (size > SIZE_CAPS.image) {
      return { error: `image exceeds ${prettyBytes(SIZE_CAPS.image)}` };
    }
    return { kind: 'PHOTO' };
  }
  if (mime.startsWith('video/')) {
    if (size > SIZE_CAPS.video) {
      return { error: `video exceeds ${prettyBytes(SIZE_CAPS.video)}` };
    }
    return { kind: 'VIDEO' };
  }
  if (mime === 'application/pdf') {
    if (size > SIZE_CAPS.doc) {
      return { error: `document exceeds ${prettyBytes(SIZE_CAPS.doc)}` };
    }
    return { kind: 'DOC' };
  }
  return { error: `unsupported mime: ${mime}` };
}

function prettyBytes(b: number): string {
  if (b >= 1024 * 1024 * 1024) return `${Math.round(b / 1024 / 1024 / 1024)} GB`;
  if (b >= 1024 * 1024) return `${Math.round(b / 1024 / 1024)} MB`;
  return `${b} bytes`;
}

// Audit hooks live here too so callers don't reach into prisma directly.
export async function auditDriveOp(input: {
  actorId: string | null;
  action: 'rename' | 'move' | 'trash' | 'restore' | 'delete';
  entityType: 'MediaAsset' | 'Animal' | 'Activity';
  entityId: string;
  before?: unknown;
  after?: unknown;
  context?: Record<string, unknown>;
}): Promise<void> {
  await writeAuditLog(prisma, {
    actorId: input.actorId,
    action: 'update',
    entityType: input.entityType,
    entityId: input.entityId,
    before: input.before,
    after: input.after,
    context: { driveOp: input.action, ...(input.context ?? {}) },
  });
}
