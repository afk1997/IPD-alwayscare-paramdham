'use server';
import { getCurrentUser } from '@/lib/auth';
import { RbacError } from '@/lib/errors';
import { revalidateTag, unstable_cache } from 'next/cache';
import { type CreateActivityInput, CreateActivitySchema, type UpdateActivityInput } from './schema';
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

// Tag map for activity mutations:
//   - 'today-timeline'  — the today-page timeline cache (always bust)
//   - 'activities'      — ⌘K search cache (always bust)
//   - 'today-counts'    — dashboard counts cache.  Only SURGERY changes
//                         a count; routine ROUND/TREATMENT/FOOD/etc.
//                         saves no longer bust this, so the counts
//                         stay cached for the full 60s revalidate.
function bustForActivityMutation(type?: string) {
  revalidateTag('today-timeline');
  revalidateTag('activities');
  if (type === 'SURGERY') revalidateTag('today-counts');
}

export async function createActivityAction(input: CreateActivityInput): Promise<ActivityActionResult> {
  try {
    const actor = await requireActor();
    const parsed = CreateActivitySchema.parse(input);
    const activity = await createActivity(actor, parsed);
    bustForActivityMutation(parsed.type);
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
    const result = await softDeleteActivity(actor, activityId);
    bustForActivityMutation(result.type);
    return { ok: true };
  } catch (e) {
    if (e instanceof RbacError) return { ok: false, error: e.message };
    throw e;
  }
}

export async function restoreActivityAction(activityId: string): Promise<ActivityActionResult> {
  try {
    const actor = await requireActor();
    const result = await restoreActivity(actor, activityId);
    bustForActivityMutation(result.type);
    return { ok: true, activityId };
  } catch (e) {
    if (e instanceof RbacError) return { ok: false, error: e.message };
    throw e;
  }
}

export interface ActivitySearchResult {
  id: string;
  animalId: string;
  animalName: string;
  type: string;
  remarks: string | null;
  occurredAt: string;
}

// The ⌘K command palette refetches on every keystroke (debounced).  Without
// a cache, even repeated identical queries hit Postgres — bad for the
// noisy "type, backspace, type again" pattern.  30s is short enough that
// new entries surface quickly without invalidating on every save.
const _searchActivitiesCached = unstable_cache(
  async (q: string): Promise<ActivitySearchResult[]> => {
    const { prisma } = await import('@/lib/prisma');
    const rows = await prisma.activity.findMany({
      where: {
        deletedAt: null,
        OR: [
          { remarks: { contains: q, mode: 'insensitive' } },
          { byName: { contains: q, mode: 'insensitive' } },
        ],
      },
      orderBy: { occurredAt: 'desc' },
      take: 10,
      select: {
        id: true,
        animalId: true,
        type: true,
        remarks: true,
        occurredAt: true,
        animal: { select: { name: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      animalId: r.animalId,
      animalName: r.animal.name,
      type: r.type,
      remarks: r.remarks,
      occurredAt: r.occurredAt.toISOString(),
    }));
  },
  ['search-activities'],
  { revalidate: 30, tags: ['activities'] },
);

export async function searchActivitiesAction(query: string): Promise<ActivitySearchResult[]> {
  await requireActor();
  const q = query.trim();
  if (q.length < 2) return [];
  return _searchActivitiesCached(q);
}

export async function updateActivityAction(
  activityId: string,
  patch: UpdateActivityInput,
): Promise<ActivityActionResult> {
  try {
    const actor = await requireActor();
    const updated = await updateActivity(actor, activityId, patch);
    bustForActivityMutation(updated.type);
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
    bustForActivityMutation(created.type);
    return { ok: true, activityId: created.id };
  } catch (e) {
    if (e instanceof RbacError) return { ok: false, error: e.message };
    throw e;
  }
}
