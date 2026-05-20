'use server';
import { getCurrentUser } from '@/lib/auth';
import { RbacError, ValidationError } from '@/lib/errors';
import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { type InviteUserInput, InviteUserSchema, type UpdateUserInput, UpdateUserSchema } from './schema';
import { deactivateUser, inviteUser, updateUser } from './service';

async function requireActor() {
  const user = await getCurrentUser();
  if (!user) throw new RbacError('not authenticated');
  return { id: user.id, role: user.role };
}

export interface UserActionResult {
  ok: boolean;
  userId?: string;
  error?: string;
}

export async function inviteUserAction(input: InviteUserInput): Promise<UserActionResult> {
  try {
    const actor = await requireActor();
    const parsed = InviteUserSchema.parse(input);
    const user = await inviteUser(actor, parsed);
    revalidatePath('/admin/users');
    // Logged-by dropdown listens on this tag — invite/update/deactivate
    // all change the active-users projection.
    revalidateTag('active-users');
    return { ok: true, userId: user.id };
  } catch (e) {
    if (e instanceof RbacError) return { ok: false, error: e.message };
    if (e instanceof ValidationError) return { ok: false, error: e.message };
    if (e && typeof e === 'object' && 'issues' in e) {
      const z = e as { issues?: Array<{ message?: string }> };
      return { ok: false, error: z.issues?.[0]?.message ?? 'Invalid input' };
    }
    throw e;
  }
}

export async function updateUserAction(input: UpdateUserInput): Promise<UserActionResult> {
  try {
    const actor = await requireActor();
    const parsed = UpdateUserSchema.parse(input);
    await updateUser(actor, parsed);
    revalidatePath('/admin/users');
    // Logged-by dropdown listens on this tag — invite/update/deactivate
    // all change the active-users projection.
    revalidateTag('active-users');
    return { ok: true, userId: parsed.id };
  } catch (e) {
    if (e instanceof RbacError) return { ok: false, error: e.message };
    if (e instanceof ValidationError) return { ok: false, error: e.message };
    throw e;
  }
}

export async function deactivateUserAction(userId: string): Promise<UserActionResult> {
  try {
    const actor = await requireActor();
    await deactivateUser(actor, userId);
    revalidatePath('/admin/users');
    // Logged-by dropdown listens on this tag — invite/update/deactivate
    // all change the active-users projection.
    revalidateTag('active-users');
    return { ok: true, userId };
  } catch (e) {
    if (e instanceof RbacError) return { ok: false, error: e.message };
    throw e;
  }
}

export async function redirectAfterInvite(userId: string): Promise<void> {
  redirect(`/admin/users#${userId}`);
}
