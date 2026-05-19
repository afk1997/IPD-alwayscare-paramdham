'use server';
import { getCurrentUser } from '@/lib/auth';
import { RbacError } from '@/lib/errors';
import { revalidateTag } from 'next/cache';
import { type CreateActivityInput, CreateActivitySchema } from './schema';
import {
  type ActivityActor,
  createActivity,
  duplicateActivity,
  restoreActivity,
  softDeleteActivity,
  updateActivity,
} from './service';

async function requireActor(): Promise<ActivityActor> {
  const user = await getCurrentUser();
  if (!user) throw new RbacError('not authenticated');
  return { id: user.id, role: user.role, name: user.name };
}

export interface ActivityActionResult {
  ok: boolean;
  activityId?: string;
  error?: string;
}

export async function createActivityAction(input: CreateActivityInput): Promise<ActivityActionResult> {
  try {
    const actor = await requireActor();
    const parsed = CreateActivitySchema.parse(input);
    const activity = await createActivity(actor, parsed);
    revalidateTag('today-counts');
    return { ok: true, activityId: activity.id };
  } catch (e) {
    if (e instanceof RbacError) return { ok: false, error: e.message };
    if (e && typeof e === 'object' && 'issues' in e) {
      const z = e as { issues?: Array<{ message?: string }> };
      return { ok: false, error: z.issues?.[0]?.message ?? 'Invalid input' };
    }
    throw e;
  }
}

export async function deleteActivityAction(activityId: string): Promise<ActivityActionResult> {
  try {
    const actor = await requireActor();
    await softDeleteActivity(actor, activityId);
    revalidateTag('today-counts');
    return { ok: true };
  } catch (e) {
    if (e instanceof RbacError) return { ok: false, error: e.message };
    throw e;
  }
}

export async function restoreActivityAction(activityId: string): Promise<ActivityActionResult> {
  try {
    const actor = await requireActor();
    await restoreActivity(actor, activityId);
    revalidateTag('today-counts');
    return { ok: true, activityId };
  } catch (e) {
    if (e instanceof RbacError) return { ok: false, error: e.message };
    throw e;
  }
}

export async function updateActivityAction(
  activityId: string,
  patch: { remarks?: string | null; data?: unknown; occurredAt?: string; byName?: string },
): Promise<ActivityActionResult> {
  try {
    const actor = await requireActor();
    const updated = await updateActivity(actor, activityId, patch);
    revalidateTag('today-counts');
    return { ok: true, activityId: updated.id };
  } catch (e) {
    if (e instanceof RbacError) return { ok: false, error: e.message };
    if (e && typeof e === 'object' && 'issues' in e) {
      const z = e as { issues?: Array<{ message?: string }> };
      return { ok: false, error: z.issues?.[0]?.message ?? 'Invalid input' };
    }
    throw e;
  }
}

export async function duplicateActivityAction(activityId: string): Promise<ActivityActionResult> {
  try {
    const actor = await requireActor();
    const created = await duplicateActivity(actor, activityId);
    revalidateTag('today-counts');
    return { ok: true, activityId: created.id };
  } catch (e) {
    if (e instanceof RbacError) return { ok: false, error: e.message };
    throw e;
  }
}
