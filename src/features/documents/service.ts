import { writeAuditLog } from '@/lib/audit';
import { NotFoundError, RbacError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { type Actor, assertCan, can } from '@/lib/rbac';
import type { DocCategory } from '@prisma/client';
import { type CreateDocumentInput, CreateDocumentSchema } from './schema';

export async function createDocument(actor: Actor, input: CreateDocumentInput) {
  assertCan(actor, 'document.create');
  const parsed = CreateDocumentSchema.parse(input);

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
  const doc = await prisma.document.findUnique({ where: { id: documentId } });
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
      before: { category: doc.category, kind: doc.kind },
    });
    return updated;
  });
}
