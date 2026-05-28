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

export interface AnimalDetailRow {
  id: string;
  name: string;
  species: string;
  breed: string | null;
  gender: string | null;
  ageText: string | null;
  color: string | null;
  weightKg: string | null;
  vaccination: string;
  sterilized: boolean;
  aggressive: boolean;
  contagious: boolean;
  ward: string | null;
  cage: string | null;
  cageId: string | null;
  status: string;
  admittedAt: string;
  complaint: string | null;
  history: string | null;
  injuryType: string | null;
  diagnosis: string | null;
  immediateTreatment: string | null;
  surgeryRequired: string | null;
  rescuer: string | null;
  rescuerPhone: string | null;
  address: string | null;
  ngo: string | null;
  broughtBy: string | null;
  testsAdvised: string[];
}

export interface UpdateAnimalActionResult {
  ok: boolean;
  animal?: AnimalDetailRow;
  error?: string;
}

export async function updateAnimalAction(
  animalId: string,
  patch: UpdateAnimalPatch,
): Promise<UpdateAnimalActionResult> {
  try {
    const actor = await requireActor();
    const updated = await updateAnimal(actor, animalId, patch);
    revalidateTag('animals');
    revalidateTag('today-counts');
    revalidateTag('today-timeline');
    const animal: AnimalDetailRow = {
      id: updated.id,
      name: updated.name,
      species: updated.species,
      breed: updated.breed,
      gender: updated.gender,
      ageText: updated.ageText,
      color: updated.color,
      weightKg: updated.weightKg ? String(updated.weightKg) : null,
      vaccination: updated.vaccination,
      sterilized: updated.sterilized,
      aggressive: updated.aggressive,
      contagious: updated.contagious,
      ward: updated.ward,
      cage: updated.cage?.name ?? null,
      cageId: updated.cageId,
      status: updated.status,
      admittedAt: updated.admittedAt.toISOString(),
      complaint: updated.complaint,
      history: updated.history,
      injuryType: updated.injuryType,
      diagnosis: updated.diagnosis,
      immediateTreatment: updated.immediateTreatment,
      surgeryRequired: updated.surgeryRequired,
      rescuer: updated.rescuer,
      rescuerPhone: updated.rescuerPhone,
      address: updated.address,
      ngo: updated.ngo,
      broughtBy: updated.broughtBy,
      testsAdvised: updated.testsAdvised.map((t) => t.test),
    };
    return { ok: true, animal };
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
  // Empty query is fine — the result is already capped at 50, so neither
  // the active-only list nor the include-past variant can dump unbounded
  // rows. The by-animal report page and the "Show past patients" toggle
  // both rely on an empty-query first render.
  const q = query.trim().slice(0, 64);
  return searchActiveAnimals(q, 50, includePast);
}
