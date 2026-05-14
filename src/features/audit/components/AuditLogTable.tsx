import { relativeTime } from '@/lib/time';
import type { AuditLog } from '@prisma/client';

type Row = AuditLog & { actor: { id: string; name: string } | null };

interface Props {
  rows: Row[];
}

const ACTION_TONES: Record<string, string> = {
  create: 'bg-stable-bg text-stable',
  update: 'bg-accent-soft text-accent-ink',
  delete: 'bg-critical-bg text-critical',
  restore: 'bg-observation-bg text-observation',
  login: 'bg-paper-2 text-muted',
};

export function AuditLogTable({ rows }: Props) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted">No audit entries match the filter.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-paper">
      <table className="w-full text-sm">
        <thead className="bg-paper-2 text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-3 py-2 text-left">When</th>
            <th className="px-3 py-2 text-left">Actor</th>
            <th className="px-3 py-2 text-left">Action</th>
            <th className="px-3 py-2 text-left">Entity</th>
            <th className="px-3 py-2 text-left">ID</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-line">
              <td className="px-3 py-2 font-mono text-xs">{relativeTime(r.createdAt)}</td>
              <td className="px-3 py-2">{r.actor?.name ?? '—'}</td>
              <td className="px-3 py-2">
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${ACTION_TONES[r.action] ?? 'bg-paper-2 text-muted'}`}
                >
                  {r.action}
                </span>
              </td>
              <td className="px-3 py-2">{r.entityType}</td>
              <td className="px-3 py-2 font-mono text-xs text-muted">{r.entityId.slice(0, 12)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
