import { EditUserForm } from '@/features/users/components/EditUserForm';
import { getUserById } from '@/features/users/queries';
import type { Role } from '@/features/users/schema';
import { requireAdminRole } from '@/lib/auth';
import { notFound } from 'next/navigation';

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminRole();
  const { id } = await params;
  const user = await getUserById(id);
  if (!user) notFound();
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-bold tracking-tight">Edit user</h1>
      <EditUserForm
        user={{
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role as Role,
          active: user.active,
        }}
      />
    </div>
  );
}
