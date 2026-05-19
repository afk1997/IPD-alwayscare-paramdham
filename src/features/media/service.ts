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

  // Insert the PENDING asset row.  We stash the expected Drive parent
  // folder id inside `storageKey` (prefixed `pending:`) so finalize can
  // verify the uploaded file actually landed there.  Once finalized,
  // the same column flips to `gdrive:${fileId}`.
  const asset = await prisma.mediaAsset.create({
    data: {
      kind: classified.kind,
      filename: input.filename,
      originalFilename: input.filename,
      mimeType: input.mime,
      size: input.size,
      storageKey: `pending:${parentId}`,
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

  // Verify the uploaded file actually landed in the parent folder we gave
  // the client at initiate time.  Without this, any authenticated user
  // could submit an arbitrary `driveFileId` and link our DB row to a file
  // under the service account that they were never authorised to write.
  const expectedParent = asset.storageKey.startsWith('pending:')
    ? asset.storageKey.slice('pending:'.length)
    : null;

  let width: number | null = null;
  let height: number | null = null;
  let durationSec: number | null = null;
  let size = asset.size;
  try {
    const meta = await storage.getFileMetadata(input.driveFileId);
    if (expectedParent && !(meta.parents ?? []).includes(expectedParent)) {
      throw new ValidationError('uploaded file does not match initiated session');
    }
    // Mime family must match what we classified at initiate time (image /
    // video / pdf).  Catches the SVG-as-image stored-XSS vector.
    const actualMime = meta.mimeType ?? asset.mimeType;
    if (mimeFamily(actualMime) !== mimeFamily(asset.mimeType)) {
      throw new ValidationError('uploaded file mime type does not match declared type');
    }
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
  } catch (e) {
    // Validation errors must bubble up; only metadata-fetch hiccups are
    // swallowed.
    if (e instanceof ValidationError) throw e;
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

/**
 * Look up a media asset for read; throws RbacError if the actor isn't
 * allowed to view it.  An actor may read an asset when:
 *   1. they uploaded it (covers pending + in-progress flows), OR
 *   2. it's linked to at least one Animal/Activity/Document (i.e. it has
 *      been adopted into the medical record), OR
 *   3. they have audit-read access (ADMIN).
 *
 * Without rule (2) any authenticated user could stream any uploaded file
 * by guessing its id — including X-rays / death certificates / postmortem
 * reports — which was the bug C2 from the review.
 */
export async function getMediaForRead(actor: Actor, assetId: string): Promise<MediaForRead> {
  const asset = await prisma.mediaAsset.findUnique({
    where: { id: assetId },
    select: {
      id: true,
      status: true,
      storageKey: true,
      mimeType: true,
      size: true,
      uploadedById: true,
      _count: {
        select: { animalMedia: true, activityMedia: true, documents: true },
      },
    },
  });
  if (!asset) throw new NotFoundError('MediaAsset', assetId);

  const isOwner = asset.uploadedById === actor.id;
  const isLinked = asset._count.animalMedia + asset._count.activityMedia + asset._count.documents > 0;
  const isAuditor = can(actor, 'audit.read.all');

  if (!(isOwner || isLinked || isAuditor)) {
    throw new RbacError('media.read');
  }

  return {
    id: asset.id,
    status: asset.status,
    storageKey: asset.storageKey,
    mimeType: asset.mimeType,
    size: asset.size,
  };
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

/**
 * Reject any attempt to attach a media asset that the actor doesn't own or
 * that isn't ready.  Stops a user from linking another user's just-uploaded
 * asset (whose id they discovered) to their own animal / activity /
 * document record — which would otherwise grant them a back-door read
 * path via `/api/files/[id]`.
 */
export async function assertOwnedReadyAssets(actor: Actor, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const rows = await prisma.mediaAsset.findMany({
    where: { id: { in: ids } },
    select: { id: true, uploadedById: true, status: true },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const id of ids) {
    const row = byId.get(id);
    if (!row) throw new NotFoundError('MediaAsset', id);
    if (row.uploadedById !== actor.id) {
      throw new RbacError('cannot attach asset uploaded by another user');
    }
    if (row.status !== 'READY') {
      throw new ValidationError('asset not finalized yet');
    }
  }
}

function mimeFamily(mime: string): 'image' | 'video' | 'pdf' | 'other' {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime === 'application/pdf') return 'pdf';
  return 'other';
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
