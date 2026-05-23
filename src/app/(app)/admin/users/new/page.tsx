import { InviteUserForm } from '@/features/users/components/InviteUserForm';
import type { Role } from '@/features/users/schema';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function InviteUserPage() {
  const actor = await getCurrentUser();
  if (!actor) redirect('/login');
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-bold tracking-tight">Invite user</h1>
      <InviteUserForm currentUserRole={actor.role as Role} />
    </div>
  );
}
