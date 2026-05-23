import { InviteUserForm } from '@/features/users/components/InviteUserForm';
import { requireAdminRole } from '@/lib/auth';

export default async function InviteUserPage() {
  await requireAdminRole();
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-bold tracking-tight">Invite user</h1>
      <InviteUserForm />
    </div>
  );
}
