import { relativeTime } from '@/lib/time';
import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { listNeedsAttention } from '../queries';

export async function NeedsAttention() {
  const items = await listNeedsAttention();
  if (items.length === 0) {
    return <p className="text-sm text-muted">All patients have a recent update. No critical cases.</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {items.map((i) => (
        <li key={i.id}>
          <Link
            href={`/patients/${i.id}`}
            className="flex items-center justify-between rounded-md border border-line bg-paper px-3 py-2 hover:bg-paper-2"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle
                size={14}
                className={i.status === 'CRITICAL' ? 'text-critical' : 'text-observation'}
              />
              <span className="font-medium">{i.name}</span>
              <span className="text-xs text-muted">· {i.species}</span>
            </div>
            <span className="text-xs text-muted">
              {i.status === 'CRITICAL' ? 'Critical' : `last ${relativeTime(i.lastActivityAt)}`}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
