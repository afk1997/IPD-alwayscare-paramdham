'use server';
import { getCurrentUser } from '@/lib/auth';
import { RbacError } from '@/lib/errors';
import { revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { type DeathInput, DeathSchema, type DischargeInput, DischargeSchema } from './schema';
import { dischargeAnimal, recordDeath } from './service';

async function requireActor() {
  const user = await getCurrentUser();
  if (!user) throw new RbacError('not authenticated');
  return { id: user.id, role: user.role, name: user.name };
}

export interface LifecycleResult {
  ok: boolean;
  error?: string;
}

export async function dischargeAction(input: DischargeInput): Promise<LifecycleResult> {
  let animalId: string;
  try {
    const actor = await requireActor();
    const parsed = DischargeSchema.parse(input);
    await dischargeAnimal(actor, parsed);
    animalId = parsed.animalId;
    revalidateTag('animals');
    revalidateTag('today-counts');
    revalidateTag(`animal:${parsed.animalId}:activities`);
  } catch (e) {
    if (e instanceof RbacError) return { ok: false, error: e.message };
    if (e && typeof e === 'object' && 'issues' in e) {
      const z = e as { issues?: Array<{ message?: string }> };
      return { ok: false, error: z.issues?.[0]?.message ?? 'Invalid input' };
    }
    throw e;
  }
  redirect(`/patients/${animalId}`);
}

export async function deathAction(input: DeathInput): Promise<LifecycleResult> {
  let animalId: string;
  try {
    const actor = await requireActor();
    const parsed = DeathSchema.parse(input);
    await recordDeath(actor, parsed);
    animalId = parsed.animalId;
    revalidateTag('animals');
    revalidateTag('today-counts');
    revalidateTag(`animal:${parsed.animalId}:activities`);
  } catch (e) {
    if (e instanceof RbacError) return { ok: false, error: e.message };
    if (e && typeof e === 'object' && 'issues' in e) {
      const z = e as { issues?: Array<{ message?: string }> };
      return { ok: false, error: z.issues?.[0]?.message ?? 'Invalid input' };
    }
    throw e;
  }
  redirect(`/patients/${animalId}`);
}
