'use server';
import { getCurrentUser } from '@/lib/auth';
import { RbacError, ValidationError } from '@/lib/errors';
import { revalidatePath, revalidateTag } from 'next/cache';
import { createCage, deleteCage, renameCage } from './service';

async function requireActor() {
  const user = await getCurrentUser();
  if (!user) throw new RbacError('not authenticated');
  return { id: user.id, role: user.role };
}

export interface CageRow {
  id: string;
  name: string;
  occupant: {
    id: string;
    name: string;
    species: string;
    status: string;
  } | null;
}

export interface CageActionResult {
  ok: boolean;
  cage?: CageRow;
  error?: string;
}

function mapError(e: unknown): CageActionResult {
  if (e instanceof RbacError) return { ok: false, error: e.message };
  if (e instanceof ValidationError) return { ok: false, error: e.message };
  if (e && typeof e === 'object' && 'issues' in e) {
    const z = e as { issues?: Array<{ message?: string }> };
    return { ok: false, error: z.issues?.[0]?.message ?? 'Invalid input' };
  }
  throw e;
}

function revalidateCages() {
  revalidatePath('/cages');
  // The cage picker on admission/edit reads assignable cages via the
  // `animals` tag-cached search; refresh it too.
  revalidateTag('animals');
}

export async function createCageAction(name: string): Promise<CageActionResult> {
  try {
    const actor = await requireActor();
    const created = await createCage(actor, { name });
    revalidateCages();
    return { ok: true, cage: created };
  } catch (e) {
    return mapError(e);
  }
}

export async function renameCageAction(id: string, name: string): Promise<CageActionResult> {
  try {
    const actor = await requireActor();
    const updated = await renameCage(actor, { id, name });
    revalidateCages();
    return { ok: true, cage: updated };
  } catch (e) {
    return mapError(e);
  }
}

export async function deleteCageAction(id: string): Promise<CageActionResult> {
  try {
    const actor = await requireActor();
    await deleteCage(actor, { id });
    revalidateCages();
    return { ok: true };
  } catch (e) {
    return mapError(e);
  }
}
