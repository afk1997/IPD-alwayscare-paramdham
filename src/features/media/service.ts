import { writeAuditLog } from '@/lib/audit';
import { NotFoundError, RbacError, ValidationError } from '@/lib/errors';
import { folderResolver } from '@/lib/folders';
import { prisma } from '@/lib/prisma';
import { type Actor, assertCan, assertOpenCase, can } from '@/lib/rbac';
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
  // API-7: sanitise the filename at the boundary so any control chars or
  // Drive-hostile glyphs from the client are dropped before either Drive
  // or the audit log sees them.
  const { sanitizeFilename } = await import('@/lib/folders');
  const cleanFilename = sanitizeFilename(input.filename);
  if (!cleanFilename) throw new ValidationError('Invalid filename');

  // Resolve folder.
  const folders = folderResolver();
  let parentId: string;
  if (input.context.kind === 'staging') {
    // RBAC-1: scope the staging sessionId by actor so user B cannot write
    // into user A's staging folder by guessing A's sessionId.
    const scopedSession = `${actor.id}:${input.context.sessionId}`;
    parentId = await folders.stagingFolder(scopedSession);
  } else {
    const animal = await prisma.animal.findUnique({
      where: { id: input.context.animalId },
      select: { id: true, name: true, status: true },
    });
    if (!animal) throw new NotFoundError('Animal', input.context.animalId);
    assertOpenCase(actor, animal.status);
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
    filename: cleanFilename,
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
      filename: cleanFilename,
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

import type { DriveMetadata as DriveMeta } from '@/lib/storage/gdrive';

async function fetchDriveMetadata(driveFileId: string): Promise<DriveMeta> {
  // STO-3: do NOT swallow metadata fetch failures.  An attacker could
  // otherwise force getFileMetadata to throw and the original code would
  // skip both the parent and mime-family checks.
  const storage = getStorage();
  if (!isGoogleDriveStorage(storage)) {
    throw new ValidationError('gdrive storage required');
  }
  try {
    return await storage.getFileMetadata(driveFileId);
  } catch (e) {
    if (e instanceof ValidationError) throw e;
    throw new ValidationError('could not verify uploaded file');
  }
}

function verifyDriveMetadata(
  meta: DriveMeta,
  expectedParent: string | null,
  declaredMime: string,
): { width: number | null; height: number | null; durationSec: number | null; size: number | null } {
  if (expectedParent && !(meta.parents ?? []).includes(expectedParent)) {
    throw new ValidationError('uploaded file does not match initiated session');
  }
  const actualMime = meta.mimeType ?? declaredMime;
  // STO-10: for image/* require exact mime equality (was family-only).
  // A client declaring `image/png` but actually uploading `image/svg+xml`
  // was previously caught by the SVG ban + family check; this tightens
  // it further so any image-family mismatch is rejected at finalize.
  if (declaredMime.startsWith('image/') || actualMime.startsWith('image/')) {
    if (actualMime !== declaredMime) {
      throw new ValidationError('uploaded file mime type does not match declared type');
    }
  } else if (mimeFamily(actualMime) !== mimeFamily(declaredMime)) {
    throw new ValidationError('uploaded file mime type does not match declared type');
  }
  const width = meta.imageMediaMetadata?.width ?? null;
  const height = meta.imageMediaMetadata?.height ?? null;
  let durationSec: number | null = null;
  if (meta.videoMediaMetadata?.durationMillis) {
    const ms = Number(meta.videoMediaMetadata.durationMillis);
    if (Number.isFinite(ms) && ms > 0) durationSec = Math.round(ms / 1000);
  }
  let size: number | null = null;
  if (meta.size) {
    const sz = Number(meta.size);
    if (Number.isFinite(sz) && sz > 0) size = sz;
  }
  return { width, height, durationSec, size };
}

async function assertCanFinalize(actor: Actor, assetId: string, expectedKey: string) {
  const asset = await prisma.mediaAsset.findUnique({ where: { id: assetId } });
  if (!asset) throw new NotFoundError('MediaAsset', assetId);
  // RBAC-10: only the original uploader can finalize.
  if (asset.uploadedById !== actor.id) throw new RbacError('finalize.notOwner');
  // STO-1: reject if any OTHER asset already points at this Drive file.
  const replay = await prisma.mediaAsset.findFirst({
    where: { storageKey: expectedKey, NOT: { id: asset.id } },
    select: { id: true },
  });
  if (replay) throw new ValidationError('driveFileId already claimed by another asset');
  return asset;
}

export async function finalizeUpload(actor: Actor, input: FinalizeInput) {
  const expectedKey = `gdrive:${input.driveFileId}`;
  const asset = await assertCanFinalize(actor, input.assetId, expectedKey);

  // Idempotent: same key on a READY asset is a noop. Different key → reject.
  if (asset.status === 'READY') {
    if (asset.storageKey !== expectedKey) {
      throw new ValidationError('asset already finalized with a different file');
    }
    return asset;
  }

  const expectedParent = asset.storageKey.startsWith('pending:')
    ? asset.storageKey.slice('pending:'.length)
    : null;
  const meta = await fetchDriveMetadata(input.driveFileId);
  const verified = verifyDriveMetadata(meta, expectedParent, asset.mimeType);

  // STO-11: condition the update on the row still being PENDING so a
  // concurrent finalize on the same assetId loses the race cleanly
  // (Prisma throws P2025 if no row matches; we treat that as "another
  // worker already finalized" and return the now-READY row).
  try {
    return await prisma.mediaAsset.update({
      where: { id: input.assetId, status: 'PENDING' },
      data: {
        storageKey: expectedKey,
        status: 'READY',
        size: verified.size ?? asset.size,
        width: verified.width,
        height: verified.height,
        durationSec: verified.durationSec,
      },
    });
  } catch (e) {
    if (e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === 'P2025') {
      const winner = await prisma.mediaAsset.findUnique({ where: { id: input.assetId } });
      if (winner && winner.status === 'READY') return winner;
    }
    throw e;
  }
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
    },
  });
  if (!asset) throw new NotFoundError('MediaAsset', assetId);

  const isOwner = asset.uploadedById === actor.id;
  const isAuditor = can(actor, 'audit.read.all');

  let isLinked = false;
  if (!isOwner && !isAuditor) {
    // Soft-deleted parents (Activity.deletedAt / Animal.deletedAt /
    // Document.deletedAt) must NOT grant read; that was the IDOR finding
    // API-1 from the pre-launch review.
    const [animalLink, activityLink, documentLink] = await Promise.all([
      prisma.animalMedia.findFirst({
        where: { assetId, animal: { deletedAt: null } },
        select: { id: true },
      }),
      prisma.activityMedia.findFirst({
        where: { assetId, activity: { deletedAt: null, animal: { deletedAt: null } } },
        select: { id: true },
      }),
      prisma.document.findFirst({
        where: { fileId: assetId, deletedAt: null, animal: { deletedAt: null } },
        select: { id: true },
      }),
    ]);
    isLinked = Boolean(animalLink || activityLink || documentLink);
  }

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

/**
 * Look up a media asset for the SIGNED read path (`/api/files/[id]?sig=…`).
 *
 * There is no actor here — a valid HMAC signature is the capability, so the
 * id-guessing IDOR that getMediaForRead's rule (2) defends against isn't
 * reachable.  But soft-delete must still revoke access (parity with the API-1
 * fix): once an asset's clinical record is trashed, its signed URL must stop
 * resolving.  We can't simply require a live link, because a just-finalized
 * asset is briefly unlinked while the client builds the activity/document
 * form — MediaUploader renders the signed URL as an upload preview before the
 * row exists.  So: serve when the asset has NO links yet (fresh upload) OR has
 * at least one link to a non-deleted parent; revoke (return null → 410) only
 * when every parent has been soft-deleted.  This only runs on a CDN cache
 * miss, so the extra link lookups don't touch the warm hot path.
 */
export async function getSignedMediaForRead(assetId: string): Promise<MediaForRead | null> {
  const asset = await prisma.mediaAsset.findUnique({
    where: { id: assetId },
    select: { id: true, status: true, storageKey: true, mimeType: true, size: true },
  });
  if (!asset || asset.status !== 'READY' || !asset.storageKey) return null;

  const [liveAnimal, liveActivity, liveDocument] = await Promise.all([
    prisma.animalMedia.findFirst({
      where: { assetId, animal: { deletedAt: null } },
      select: { id: true },
    }),
    prisma.activityMedia.findFirst({
      where: { assetId, activity: { deletedAt: null, animal: { deletedAt: null } } },
      select: { id: true },
    }),
    prisma.document.findFirst({
      where: { fileId: assetId, deletedAt: null, animal: { deletedAt: null } },
      select: { id: true },
    }),
  ]);
  const hasLiveLink = Boolean(liveAnimal || liveActivity || liveDocument);
  if (!hasLiveLink) {
    // No live link: distinguish a not-yet-linked fresh upload (serve) from an
    // asset whose every parent has been soft-deleted (revoke).
    const [anyAnimal, anyActivity, anyDocument] = await Promise.all([
      prisma.animalMedia.findFirst({ where: { assetId }, select: { id: true } }),
      prisma.activityMedia.findFirst({ where: { assetId }, select: { id: true } }),
      prisma.document.findFirst({ where: { fileId: assetId }, select: { id: true } }),
    ]);
    if (anyAnimal || anyActivity || anyDocument) return null; // all parents trashed → revoke
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
  if (mime === 'image/svg+xml') {
    // API-3: reject SVG outright — the bytes can carry script and
    // foreignObject content that defeats nosniff + CSP combinations under
    // legacy browsers.
    return { error: 'SVG uploads are not allowed' };
  }
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
