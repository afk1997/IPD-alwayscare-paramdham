'use server';
import { getCurrentUser } from '@/lib/auth';
import { RbacError, ValidationError } from '@/lib/errors';
import { revalidatePath, revalidateTag } from 'next/cache';
import { type DeathInput, DeathSchema, type DischargeInput, DischargeSchema } from './schema';
import { dischargeAnimal, invalidateLifecycle, recordDeath, revalidateLifecycle } from './service';

async function requireActor() {
  const user = await getCurrentUser();
  if (!user) throw new RbacError('not authenticated');
  return { id: user.id, role: user.role, name: user.name };
}

export interface LifecycleResult {
  ok: boolean;
  error?: string;
}

function genericError(action: string, e: unknown): LifecycleResult {
  if (e instanceof RbacError) return { ok: false, error: e.message };
  if (e instanceof ValidationError) return { ok: false, error: e.message };
  if (e && typeof e === 'object' && 'issues' in e) {
    const z = e as { issues?: Array<{ message?: string }> };
    return { ok: false, error: z.issues?.[0]?.message ?? 'Invalid input' };
  }
  console.error(`[lifecycle/${action}]`, e instanceof Error ? e.message : 'unknown');
  return { ok: false, error: `Could not ${action}` };
}

export async function dischargeAction(input: DischargeInput): Promise<LifecycleResult> {
  try {
    const actor = await requireActor();
    const parsed = DischargeSchema.parse(input);
    await dischargeAnimal(actor, parsed);
    revalidateTag('animals');
    revalidateTag('today-counts');
    revalidateTag('today-timeline');
    revalidatePath(`/patients/${parsed.animalId}`);
    return { ok: true };
  } catch (e) {
    return genericError('discharge', e);
  }
}

export async function deathAction(input: DeathInput): Promise<LifecycleResult> {
  try {
    const actor = await requireActor();
    const parsed = DeathSchema.parse(input);
    await recordDeath(actor, parsed);
    revalidateTag('animals');
    revalidateTag('today-counts');
    revalidateTag('today-timeline');
    revalidatePath(`/patients/${parsed.animalId}`);
    return { ok: true };
  } catch (e) {
    return genericError('record death', e);
  }
}

export async function invalidateLifecycleAction(animalId: string): Promise<LifecycleResult> {
  try {
    const actor = await requireActor();
    await invalidateLifecycle(actor, animalId);
    revalidateTag('animals');
    revalidateTag('today-counts');
    revalidateTag('today-timeline');
    revalidatePath(`/patients/${animalId}`);
    revalidatePath('/outcomes');
    return { ok: true };
  } catch (e) {
    return genericError('reopen case', e);
  }
}

export async function revalidateLifecycleAction(animalId: string): Promise<LifecycleResult> {
  try {
    const actor = await requireActor();
    await revalidateLifecycle(actor, animalId);
    revalidateTag('animals');
    revalidateTag('today-counts');
    revalidateTag('today-timeline');
    revalidatePath(`/patients/${animalId}`);
    revalidatePath('/outcomes');
    return { ok: true };
  } catch (e) {
    return genericError('re-validate', e);
  }
}
