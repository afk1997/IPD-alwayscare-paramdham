import { InviteUserForm } from '@/features/users/components/InviteUserForm';
import type { Role } from '@/features/users/schema';
import { requireAdminRole } from '@/lib/auth';

export default async function InviteUserPage() {
  const actor = await requireAdminRole();
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-bold tracking-tight">Invite user</h1>
      <InviteUserForm currentUserRole={actor.role as Role} />
    </div>
  );
}
