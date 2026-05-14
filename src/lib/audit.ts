import { Prisma, type PrismaClient } from '@prisma/client';

type Tx = Pick<PrismaClient, 'auditLog'> | Prisma.TransactionClient;

export interface AuditEntry {
  actorId: string | null;
  action: 'create' | 'update' | 'delete' | 'restore' | 'login' | 'logout';
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  context?: Record<string, unknown>;
}

export async function writeAuditLog(tx: Tx, entry: AuditEntry): Promise<void> {
  await tx.auditLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      before: (entry.before ?? Prisma.DbNull) as Prisma.InputJsonValue,
      after: (entry.after ?? Prisma.DbNull) as Prisma.InputJsonValue,
      context: (entry.context ?? Prisma.DbNull) as Prisma.InputJsonValue,
    },
  });
}
