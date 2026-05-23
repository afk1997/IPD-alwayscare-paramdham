import { AuditLogTable } from '@/features/audit/components/AuditLogTable';
import { listAuditLog } from '@/features/audit/queries';
import { requireAdminRole } from '@/lib/auth';

export default async function AuditLogPage() {
  const user = await requireAdminRole();
  const rows = await listAuditLog({ id: user.id, role: user.role }, { take: 200 });
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Audit log</h1>
        <p className="mt-1 text-sm text-muted">Last 200 mutations across the system</p>
      </div>
      <AuditLogTable rows={rows} />
    </div>
  );
}
