'use server';
import { restoreActivity } from '@/features/activities/service';
import { restoreAnimal } from '@/features/animals/service';
import { restoreDocument } from '@/features/documents/service';
import { getCurrentUser } from '@/lib/auth';
import { NotFoundError, RbacError } from '@/lib/errors';
import { type Actor, assertCan } from '@/lib/rbac';
import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';

async function requireAdmin(): Promise<Actor> {
  const user = await getCurrentUser();
  if (!user) throw new RbacError('not authenticated');
  assertCan({ id: user.id, role: user.role }, 'trash.read');
  return { id: user.id, role: user.role };
}

export interface TrashActionResult {
  ok: boolean;
  error?: string;
}

const IdSchema = z.string().cuid();

export async function restoreActivityFromTrashAction(activityId: string): Promise<TrashActionResult> {
  try {
    const actor = await requireAdmin();
    const parsed = IdSchema.safeParse(activityId);
    if (!parsed.success) return { ok: false, error: 'Invalid id' };
    await restoreActivity(actor, parsed.data);
    revalidateTag('today-timeline');
    revalidateTag('activities');
    revalidatePath('/admin/trash');
    return { ok: true };
  } catch (e) {
    if (e instanceof RbacError) return { ok: false, error: e.message };
    if (e instanceof NotFoundError) return { ok: false, error: 'Activity not found' };
    console.error('[trash/actions] restoreActivity', e instanceof Error ? e.message : 'unknown');
    return { ok: false, error: 'Could not restore activity' };
  }
}

export async function restoreDocumentFromTrashAction(documentId: string): Promise<TrashActionResult> {
  try {
    const actor = await requireAdmin();
    const parsed = IdSchema.safeParse(documentId);
    if (!parsed.success) return { ok: false, error: 'Invalid id' };
    await restoreDocument(actor, parsed.data);
    revalidatePath('/admin/trash');
    revalidatePath('/documents');
    return { ok: true };
  } catch (e) {
    if (e instanceof RbacError) return { ok: false, error: e.message };
    if (e instanceof NotFoundError) return { ok: false, error: 'Document not found' };
    console.error('[trash/actions] restoreDocument', e instanceof Error ? e.message : 'unknown');
    return { ok: false, error: 'Could not restore document' };
  }
}

export async function restoreAnimalFromTrashAction(animalId: string): Promise<TrashActionResult> {
  try {
    const actor = await requireAdmin();
    const parsed = IdSchema.safeParse(animalId);
    if (!parsed.success) return { ok: false, error: 'Invalid id' };
    await restoreAnimal(actor, parsed.data);
    revalidateTag('animals');
    revalidateTag('today-counts');
    revalidateTag('today-timeline');
    revalidatePath('/admin/trash');
    revalidatePath('/patients');
    return { ok: true };
  } catch (e) {
    if (e instanceof RbacError) return { ok: false, error: e.message };
    if (e instanceof NotFoundError) return { ok: false, error: 'Animal not found' };
    console.error('[trash/actions] restoreAnimal', e instanceof Error ? e.message : 'unknown');
    return { ok: false, error: 'Could not restore animal' };
  }
}
