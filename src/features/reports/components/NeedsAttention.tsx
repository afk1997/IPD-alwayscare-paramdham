import { Photo } from '@/components/media/Photo';
import { relativeTime } from '@/lib/time';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { listNeedsAttention } from '../queries';

export async function NeedsAttention() {
  const items = await listNeedsAttention();
  if (items.length === 0) {
    return (
      <p className="px-1 py-2 text-sm text-muted">All patients have a recent update. No critical cases.</p>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {items.map((i) => {
        const isCritical = i.status === 'CRITICAL';
        const border = isCritical ? 'border-l-critical' : 'border-l-observation';
        const pillBg = isCritical ? 'bg-critical-bg text-critical' : 'bg-observation-bg text-observation';
        const hours = i.lastActivityAt
          ? Math.floor((Date.now() - new Date(i.lastActivityAt).getTime()) / 3_600_000)
          : null;
        const reason = isCritical ? 'Critical' : `${hours ?? '6+'}h no update`;
        return (
          <li key={i.id}>
            <Link
              href={`/patients/${i.id}`}
              className={`flex items-center gap-3 rounded-xl border border-line border-l-4 bg-paper py-2.5 pr-2.5 pl-3 transition hover:bg-paper-2 ${border}`}
            >
              <Photo seed={i.id} rounded={11} className="h-11 w-11 shrink-0" alt={i.name} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-display font-semibold">{i.name}</span>
                  {i.ward && <span className="text-[12px] text-muted">{i.ward}</span>}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${pillBg}`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    {reason}
                  </span>
                  {i.contagious && (
                    <span className="inline-flex items-center rounded-full bg-critical-bg px-2 py-0.5 text-[11px] font-semibold text-critical">
                      Contagious
                    </span>
                  )}
                </div>
              </div>
              <span className="text-[11px] text-soft">
                {i.lastActivityAt ? relativeTime(i.lastActivityAt) : '—'}
              </span>
              <ChevronRight size={14} className="shrink-0 text-soft" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
