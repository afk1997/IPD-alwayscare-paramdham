import { Button } from '@/components/ui/Button';
import { UserList } from '@/features/users/components/UserList';
import Link from 'next/link';

export default function AdminUsersPage() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Users</h1>
          <p className="mt-1 text-sm text-muted">Manage who can sign in and what they can do</p>
        </div>
        <Link href="/admin/users/new">
          <Button>Invite user</Button>
        </Link>
      </div>
      <UserList />
    </div>
  );
}
