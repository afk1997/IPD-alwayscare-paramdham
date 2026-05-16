'use server';
import { getCurrentUser } from '@/lib/auth';
import { RbacError, ValidationError } from '@/lib/errors';
import type { Actor } from '@/lib/rbac';
import { revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
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
    revalidateTag(`animal:${animalId}`);
    revalidateTag('today-counts');
    return { ok: true };
  } catch (e) {
    if (e instanceof RbacError) return { ok: false, error: e.message };
    if (e instanceof ValidationError) return { ok: false, error: e.message };
    throw e;
  }
}
