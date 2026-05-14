import { relativeTime } from '@/lib/time';
import Link from 'next/link';
import { listUsers } from '../queries';
import { RoleBadge } from './RoleBadge';

export async function UserList() {
  const users = await listUsers();
  return (
    <div className="flex flex-col gap-2">
      {users.map((u) => (
        <Link
          key={u.id}
          href={`/admin/users/${u.id}/edit`}
          id={u.id}
          className={`flex items-center justify-between rounded-lg border border-line bg-paper p-3 hover:bg-paper-2 ${u.active ? '' : 'opacity-60'}`}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium">{u.name}</span>
              <RoleBadge role={u.role} />
              {!u.active && (
                <span className="rounded bg-critical-bg px-1.5 py-0.5 text-[10px] font-bold text-critical">
                  DISABLED
                </span>
              )}
            </div>
            <div className="mt-1 text-xs text-muted">
              {u.email} · {u.lastLoginAt ? `last login ${relativeTime(u.lastLoginAt)}` : 'never logged in'}
            </div>
          </div>
          <span className="text-xs text-muted">Edit →</span>
        </Link>
      ))}
    </div>
  );
}
