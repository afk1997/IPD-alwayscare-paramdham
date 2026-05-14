import { AppShell } from '@/components/shell/AppShell';
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

  return (
    <AppShell
      user={{
        name: user.name,
        role: roleLabel[user.role] ?? user.role,
        isAdmin: user.role === 'ADMIN',
      }}
    >
      {children}
    </AppShell>
  );
}
