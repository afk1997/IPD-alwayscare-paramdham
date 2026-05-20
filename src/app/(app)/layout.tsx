import { AppShell } from '@/components/shell/AppShell';
import { listActiveUsers } from '@/features/users/queries';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';

const roleLabel: Record<string, string> = {
  STAFF: 'Floor staff',
  DOCTOR: 'Doctor',
  ADMIN: 'Admin',
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  // Fetch the active-user list — used by every activity form's
  // "Logged by" dropdown via ActiveUsersProvider mounted in AppShell.
  // Sequential after the auth check (~5 ms on Postgres for ~10 rows).
  const activeUsers = await listActiveUsers();

  return (
    <AppShell
      user={{
        name: user.name,
        role: roleLabel[user.role] ?? user.role,
        isAdmin: user.role === 'ADMIN',
      }}
      activeUsers={activeUsers}
    >
      {children}
    </AppShell>
  );
}
