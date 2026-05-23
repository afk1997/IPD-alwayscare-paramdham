import { EditUserForm } from '@/features/users/components/EditUserForm';
import { getUserById } from '@/features/users/queries';
import type { Role } from '@/features/users/schema';
import { getCurrentUser } from '@/lib/auth';
import { notFound, redirect } from 'next/navigation';

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await getCurrentUser();
  if (!actor) redirect('/login');
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
        currentUserRole={actor.role as Role}
      />
    </div>
  );
}
