import { writeAuditLog } from '@/lib/audit';
import { NotFoundError, RbacError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { type Actor, assertCan, can } from '@/lib/rbac';
import type { DocCategory } from '@prisma/client';
import { assertOwnedReadyAssets } from '../media/service';
import { type CreateDocumentInput, CreateDocumentSchema } from './schema';

export async function createDocument(actor: Actor, input: CreateDocumentInput) {
  assertCan(actor, 'document.create');
  const parsed = CreateDocumentSchema.parse(input);
  // ACT-3: refuse to attach a document to a non-existent or soft-deleted
  // animal.
  const animal = await prisma.animal.findFirst({
    where: { id: parsed.animalId, deletedAt: null },
    select: { id: true },
  });
  if (!animal) throw new NotFoundError('Animal', parsed.animalId);
  await assertOwnedReadyAssets(actor, [parsed.fileId]);

  return prisma.$transaction(async (tx) => {
    const created = await tx.document.create({
      data: {
        animalId: parsed.animalId,
        category: parsed.category as DocCategory,
        kind: parsed.kind,
        name: parsed.name,
        fileId: parsed.fileId,
        uploadedById: actor.id,
      },
    });
    await writeAuditLog(tx, {
      actorId: actor.id,
      action: 'create',
      entityType: 'Document',
      entityId: created.id,
      after: {
        category: created.category,
        kind: created.kind,
        animalId: created.animalId,
      },
    });
    return created;
  });
}

export async function softDeleteDocument(actor: Actor, documentId: string) {
  if (!can(actor, 'document.delete')) throw new RbacError('document.delete');
  const doc = await prisma.document.findFirst({
    where: { id: documentId, deletedAt: null },
  });
  if (!doc) throw new NotFoundError('Document', documentId);
  return prisma.$transaction(async (tx) => {
    const updated = await tx.document.update({
      where: { id: documentId },
      data: { deletedAt: new Date() },
    });
    await writeAuditLog(tx, {
      actorId: actor.id,
      action: 'delete',
      entityType: 'Document',
      entityId: documentId,
      before: {
        category: doc.category,
        kind: doc.kind,
        name: doc.name,
        animalId: doc.animalId,
        fileId: doc.fileId,
      },
    });
    return updated;
  });
}

export async function restoreDocument(actor: Actor, documentId: string) {
  if (!can(actor, 'document.restore')) throw new RbacError('document.restore');
  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc) throw new NotFoundError('Document', documentId);
  if (!doc.deletedAt) return doc;
  return prisma.$transaction(async (tx) => {
    const updated = await tx.document.update({
      where: { id: documentId },
      data: { deletedAt: null },
    });
    await writeAuditLog(tx, {
      actorId: actor.id,
      action: 'restore',
      entityType: 'Document',
      entityId: documentId,
      after: { category: updated.category, kind: updated.kind, animalId: updated.animalId },
    });
    return updated;
  });
}
