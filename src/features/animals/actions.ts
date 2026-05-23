'use server';
import { getCurrentUser } from '@/lib/auth';
import { RbacError, ValidationError } from '@/lib/errors';
import type { Actor } from '@/lib/rbac';
import { revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { type ActiveAnimalLite, searchActiveAnimals } from './queries';
import { type CreateAnimalInput, CreateAnimalSchema } from './schema';
import { type UpdateAnimalPatch, createAnimal, updateAnimal } from './service';

async function requireActor(): Promise<Actor> {
  const user = await getCurrentUser();
  if (!user) throw new RbacError('not authenticated');
  return { id: user.id, role: user.role };
}

export interface AdmissionActionResult {
  ok: boolean;
  animalId?: string;
  error?: string;
}

export async function createAnimalAction(input: CreateAnimalInput): Promise<AdmissionActionResult> {
  let animalId: string;
  try {
    const actor = await requireActor();
    const parsed = CreateAnimalSchema.parse(input);
    const animal = await createAnimal(actor, parsed);
    animalId = animal.id;
    revalidateTag('animals');
    revalidateTag('today-counts');
    revalidateTag('today-timeline');
  } catch (e) {
    if (e instanceof RbacError) return { ok: false, error: e.message };
    if (e instanceof ValidationError) return { ok: false, error: e.message };
    if (e && typeof e === 'object' && 'issues' in e) {
      const z = e as { issues?: Array<{ message?: string; path?: unknown[] }> };
      return { ok: false, error: z.issues?.[0]?.message ?? 'Invalid input' };
    }
    throw e;
  }
  redirect(`/patients/${animalId}`);
}

export interface UpdateAnimalActionResult {
  ok: boolean;
  error?: string;
}

export async function updateAnimalAction(
  animalId: string,
  patch: UpdateAnimalPatch,
): Promise<UpdateAnimalActionResult> {
  try {
    const actor = await requireActor();
    await updateAnimal(actor, animalId, patch);
    revalidateTag('animals');
    revalidateTag('today-counts');
    revalidateTag('today-timeline');
    return { ok: true };
  } catch (e) {
    if (e instanceof RbacError) return { ok: false, error: e.message };
    if (e instanceof ValidationError) return { ok: false, error: e.message };
    if (e && typeof e === 'object' && 'issues' in e) {
      const z = e as { issues?: Array<{ message?: string }> };
      return { ok: false, error: z.issues?.[0]?.message ?? 'Invalid input' };
    }
    console.error('[animals/actions] updateAnimalAction', e instanceof Error ? e.message : 'unknown');
    return { ok: false, error: 'Could not update animal' };
  }
}

export async function searchAnimalsAction(query: string, includePast = false): Promise<ActiveAnimalLite[]> {
  await requireActor();
  // ACT-5: when listing past patients (potentially unbounded) require a
  // minimum query length so callers can't dump the entire historical
  // roster with one empty request. For active patients alone, an empty
  // query is fine — the result is already capped at 50, and the
  // by-animal report page calls this with q='' to render the patient
  // picker on first load.
  const q = query.trim().slice(0, 64);
  if (includePast && q.length < 2) return [];
  return searchActiveAnimals(q, 50, includePast);
}
