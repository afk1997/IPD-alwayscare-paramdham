import { writeAuditLog } from '@/lib/audit';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { type Actor, assertCan } from '@/lib/rbac';
import {
  type CreateCageInput,
  CreateCageSchema,
  type DeleteCageInput,
  DeleteCageSchema,
  type RenameCageInput,
  RenameCageSchema,
} from './schema';

async function assertNameFree(name: string, exceptId?: string): Promise<void> {
  const clash = await prisma.cage.findFirst({
    where: {
      name: { equals: name, mode: 'insensitive' },
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    select: { id: true },
  });
  if (clash) throw new ValidationError('A cage with that name already exists');
}

export async function createCage(actor: Actor, input: CreateCageInput) {
  assertCan(actor, 'cage.manage');
  const parsed = CreateCageSchema.parse(input);
  await assertNameFree(parsed.name);
  return prisma.$transaction(async (tx) => {
    const cage = await tx.cage.create({
      data: { name: parsed.name },
      include: {
        occupant: { select: { id: true, name: true, species: true, status: true } },
      },
    });
    await writeAuditLog(tx, {
      actorId: actor.id,
      action: 'create',
      entityType: 'Cage',
      entityId: cage.id,
      after: { name: cage.name },
    });
    return cage;
  });
}

export async function renameCage(actor: Actor, input: RenameCageInput) {
  assertCan(actor, 'cage.manage');
  const parsed = RenameCageSchema.parse(input);
  const before = await prisma.cage.findUnique({ where: { id: parsed.id } });
  if (!before) throw new NotFoundError('Cage', parsed.id);
  await assertNameFree(parsed.name, parsed.id);
  return prisma.$transaction(async (tx) => {
    const cage = await tx.cage.update({
      where: { id: parsed.id },
      data: { name: parsed.name },
      include: {
        occupant: { select: { id: true, name: true, species: true, status: true } },
      },
    });
    await writeAuditLog(tx, {
      actorId: actor.id,
      action: 'update',
      entityType: 'Cage',
      entityId: cage.id,
      before: { name: before.name },
      after: { name: cage.name },
    });
    return cage;
  });
}

export async function deleteCage(actor: Actor, input: DeleteCageInput) {
  assertCan(actor, 'cage.manage');
  const parsed = DeleteCageSchema.parse(input);
  const cage = await prisma.cage.findUnique({
    where: { id: parsed.id },
    select: { id: true, name: true, occupant: { select: { id: true } } },
  });
  if (!cage) throw new NotFoundError('Cage', parsed.id);
  if (cage.occupant) throw new ValidationError('Cage is occupied — free it first');
  return prisma.$transaction(async (tx) => {
    await tx.cage.delete({ where: { id: parsed.id } });
    await writeAuditLog(tx, {
      actorId: actor.id,
      action: 'delete',
      entityType: 'Cage',
      entityId: parsed.id,
      before: { name: cage.name },
    });
    return { id: parsed.id };
  });
}
