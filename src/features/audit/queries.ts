import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

export interface AuditQuery {
  entityType?: string;
  actorId?: string;
  fromDate?: Date;
  toDate?: Date;
  take?: number;
}

export async function listAuditLog(q: AuditQuery = {}) {
  const where: Prisma.AuditLogWhereInput = {};
  if (q.entityType) where.entityType = q.entityType;
  if (q.actorId) where.actorId = q.actorId;
  if (q.fromDate || q.toDate) {
    where.createdAt = {};
    if (q.fromDate) where.createdAt.gte = q.fromDate;
    if (q.toDate) where.createdAt.lte = q.toDate;
  }

  return prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: q.take ?? 200,
    include: { actor: { select: { id: true, name: true } } },
  });
}
