import { requireAdminRole } from '@/lib/auth';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminRole();
  return <>{children}</>;
}
