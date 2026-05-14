import { InviteUserForm } from '@/features/users/components/InviteUserForm';

export default function InviteUserPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-bold tracking-tight">Invite user</h1>
      <InviteUserForm />
    </div>
  );
}
