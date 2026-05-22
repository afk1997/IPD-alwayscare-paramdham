import { prisma } from '@/lib/prisma';
import { type Actor, assertCan } from '@/lib/rbac';

const TRASH_PAGE_SIZE = 50;

export interface TrashActivityRow {
  id: string;
  type: string;
  occurredAt: Date;
  deletedAt: Date;
  byName: string;
  animal: { id: string; name: string; species: string } | null;
  deletedByName: string | null;
}

export interface TrashDocumentRow {
  id: string;
  category: string;
  kind: string;
  name: string;
  deletedAt: Date;
  animal: { id: string; name: string; species: string } | null;
  deletedByName: string | null;
}

export interface TrashAnimalRow {
  id: string;
  name: string;
  species: string;
  deletedAt: Date;
  admittedAt: Date;
  status: string;
  deletedByName: string | null;
}

// Look up the "who deleted" name by reading the most recent audit row
// for this entity with action='delete'. Cheap because the audit log is
// indexed on (entityType, entityId).
async function deletedByMap(entityType: 'Activity' | 'Document' | 'Animal', ids: string[]) {
  if (ids.length === 0) return new Map<string, string | null>();
  const rows = await prisma.auditLog.findMany({
    where: { entityType, entityId: { in: ids }, action: 'delete' },
    orderBy: { createdAt: 'desc' },
    select: { entityId: true, actor: { select: { name: true } } },
  });
  const map = new Map<string, string | null>();
  for (const r of rows) {
    if (!map.has(r.entityId)) map.set(r.entityId, r.actor?.name ?? null);
  }
  return map;
}

export async function listTrashActivities(
  actor: Actor,
  opts: { skip?: number; take?: number } = {},
): Promise<TrashActivityRow[]> {
  assertCan(actor, 'trash.read');
  const rows = await prisma.activity.findMany({
    where: { deletedAt: { not: null } },
    orderBy: { deletedAt: 'desc' },
    skip: opts.skip ?? 0,
    take: opts.take ?? TRASH_PAGE_SIZE,
    select: {
      id: true,
      type: true,
      occurredAt: true,
      deletedAt: true,
      byName: true,
      animal: { select: { id: true, name: true, species: true, deletedAt: true } },
    },
  });
  const deletedBy = await deletedByMap(
    'Activity',
    rows.map((r) => r.id),
  );
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    occurredAt: r.occurredAt,
    deletedAt: r.deletedAt as Date,
    byName: r.byName,
    animal: r.animal ? { id: r.animal.id, name: r.animal.name, species: r.animal.species } : null,
    deletedByName: deletedBy.get(r.id) ?? null,
  }));
}

export async function listTrashDocuments(
  actor: Actor,
  opts: { skip?: number; take?: number } = {},
): Promise<TrashDocumentRow[]> {
  assertCan(actor, 'trash.read');
  const rows = await prisma.document.findMany({
    where: { deletedAt: { not: null } },
    orderBy: { deletedAt: 'desc' },
    skip: opts.skip ?? 0,
    take: opts.take ?? TRASH_PAGE_SIZE,
    select: {
      id: true,
      category: true,
      kind: true,
      name: true,
      deletedAt: true,
      animal: { select: { id: true, name: true, species: true } },
    },
  });
  const deletedBy = await deletedByMap(
    'Document',
    rows.map((r) => r.id),
  );
  return rows.map((r) => ({
    id: r.id,
    category: r.category,
    kind: r.kind,
    name: r.name,
    deletedAt: r.deletedAt as Date,
    animal: r.animal ? { id: r.animal.id, name: r.animal.name, species: r.animal.species } : null,
    deletedByName: deletedBy.get(r.id) ?? null,
  }));
}

export async function listTrashAnimals(
  actor: Actor,
  opts: { skip?: number; take?: number } = {},
): Promise<TrashAnimalRow[]> {
  assertCan(actor, 'trash.read');
  const rows = await prisma.animal.findMany({
    where: { deletedAt: { not: null } },
    orderBy: { deletedAt: 'desc' },
    skip: opts.skip ?? 0,
    take: opts.take ?? TRASH_PAGE_SIZE,
    select: {
      id: true,
      name: true,
      species: true,
      deletedAt: true,
      admittedAt: true,
      status: true,
    },
  });
  const deletedBy = await deletedByMap(
    'Animal',
    rows.map((r) => r.id),
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    species: r.species,
    deletedAt: r.deletedAt as Date,
    admittedAt: r.admittedAt,
    status: r.status,
    deletedByName: deletedBy.get(r.id) ?? null,
  }));
}

export async function trashCounts(actor: Actor) {
  assertCan(actor, 'trash.read');
  const [activities, documents, animals] = await Promise.all([
    prisma.activity.count({ where: { deletedAt: { not: null } } }),
    prisma.document.count({ where: { deletedAt: { not: null } } }),
    prisma.animal.count({ where: { deletedAt: { not: null } } }),
  ]);
  return { activities, documents, animals };
}
