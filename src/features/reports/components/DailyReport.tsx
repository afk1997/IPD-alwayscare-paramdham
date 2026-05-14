'use client';
import { Input } from '@/components/ui/Input';
import { ACTIVITY_LABELS } from '@/features/activities/schema';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { ActivityRow } from '../queries';

interface Props {
  date: string;
  rows: ActivityRow[];
}

export function DailyReport({ date, rows }: Props) {
  const router = useRouter();
  const params = useSearchParams();

  const onChange = (value: string) => {
    const q = new URLSearchParams(params);
    q.set('date', value);
    router.replace(`/reports/today?${q.toString()}`);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="report-date" className="text-sm font-medium">
            Date
          </label>
          <Input
            id="report-date"
            type="date"
            value={date}
            onChange={(e) => onChange(e.target.value)}
            className="w-44"
          />
        </div>
        <div className="text-sm text-muted">
          {rows.length} {rows.length === 1 ? 'entry' : 'entries'}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted">No activities logged on {date}.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-paper">
          <table className="w-full text-sm">
            <thead className="bg-paper-2 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2 text-left">Time</th>
                <th className="px-3 py-2 text-left">Animal</th>
                <th className="px-3 py-2 text-left">Activity</th>
                <th className="px-3 py-2 text-left">By</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-line">
                  <td className="px-3 py-2 font-mono text-xs">
                    {r.occurredAt.toLocaleTimeString(undefined, {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-3 py-2">
                    <Link href={`/patients/${r.animalId}`} className="text-accent">
                      {r.animalName}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{ACTIVITY_LABELS[r.type]}</td>
                  <td className="px-3 py-2 text-muted">{r.byName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
