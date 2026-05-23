import { AppShell } from '@/components/shell/AppShell';
import { listActiveUsers } from '@/features/users/queries';
import { ROLE_LABELS, type Role } from '@/features/users/schema';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  // Fetch the active-user list — used by every activity form's
  // "Logged by" dropdown via ActiveUsersProvider mounted in AppShell.
  // Sequential after the auth check (~5 ms on Postgres for ~10 rows).
  const activeUsers = await listActiveUsers();
  const role = user.role as Role;
  // SUPER_ADMIN inherits the admin nav surface.
  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';

  return (
    <AppShell
      user={{
        id: user.id,
        name: user.name,
        role: ROLE_LABELS[role] ?? role,
        isAdmin,
        rawRole: role,
      }}
      activeUsers={activeUsers}
    >
      {children}
    </AppShell>
  );
}
