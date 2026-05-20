'use client';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { ACTIVITY_LABELS, ACTIVITY_TYPES, type ActivityType } from '@/features/activities/schema';
import { copyToClipboard } from '@/lib/clipboard';
import { clockTime } from '@/lib/time';
import { Download, Share2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { formatDailyReportText } from '../dailyReportText';
import type { ActivityRow } from '../queries';

interface Props {
  date: string;
  rows: ActivityRow[];
}

type TypeFilter = ActivityType | 'ALL';

const SELECTABLE: ActivityType[] = [
  'TREATMENT',
  'ROUND',
  'DIAGNOSTIC',
  'SURGERY',
  'FOOD',
  'BATH',
  'WALK',
  'ADMISSION',
];

export function DailyReport({ date, rows }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const { showToast } = useToast();
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');

  const onShare = async () => {
    // Spec rule: Share always copies the full day, never the filtered view.
    const text = formatDailyReportText(date, rows);
    await copyToClipboard(text, {
      onSuccess: () => showToast({ message: 'Daily report copied — paste in WhatsApp / Slack / etc.' }),
      onFallback: () => showToast({ message: 'Daily report copied (fallback)' }),
    });
  };

  const onDateChange = (value: string) => {
    const q = new URLSearchParams(params);
    q.set('date', value);
    router.replace(`/reports/today?${q.toString()}`);
  };

  // Per-type counts for chip badges.
  const counts = useMemo(() => {
    const byType = new Map<ActivityType, number>();
    for (const t of ACTIVITY_TYPES) byType.set(t, 0);
    for (const r of rows) byType.set(r.type, (byType.get(r.type) ?? 0) + 1);
    return byType;
  }, [rows]);

  const filtered = useMemo(() => {
    if (typeFilter === 'ALL') return rows;
    return rows.filter((r) => r.type === typeFilter);
  }, [rows, typeFilter]);

  const downloadCsv = () => {
    const header = ['Time', 'Animal', 'Activity', 'Logged by'];
    const csvRows = filtered.map((r) => [
      r.occurredAt.toISOString(),
      r.animalName,
      ACTIVITY_LABELS[r.type],
      r.byName,
    ]);
    const csv = [header, ...csvRows]
      .map((row) => row.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-report-${date}${typeFilter === 'ALL' ? '' : `-${typeFilter.toLowerCase()}`}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="report-date" className="font-medium text-sm">
              Date
            </label>
            <Input
              id="report-date"
              type="date"
              value={date}
              onChange={(e) => onDateChange(e.target.value)}
              className="w-44"
            />
          </div>
          <div className="pb-2 text-muted text-sm">
            {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
            {typeFilter !== 'ALL' && ` · ${ACTIVITY_LABELS[typeFilter]}`}
          </div>
        </div>
        <div className="flex items-center gap-2 self-end">
          <button
            type="button"
            onClick={onShare}
            disabled={rows.length === 0}
            className="flex items-center gap-1.5 rounded-md border border-line bg-paper px-3 py-1.5 font-semibold text-[12.5px] text-text transition hover:bg-paper-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Share2 size={14} />
            Share
          </button>
          <button
            type="button"
            onClick={downloadCsv}
            disabled={filtered.length === 0}
            className="flex items-center gap-1.5 rounded-md border border-line bg-paper px-3 py-1.5 font-semibold text-[12.5px] text-text transition hover:bg-paper-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download size={14} />
            Export CSV
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <TypeChip
          label={`All · ${rows.length}`}
          active={typeFilter === 'ALL'}
          onClick={() => setTypeFilter('ALL')}
        />
        {SELECTABLE.map((t) => {
          const count = counts.get(t) ?? 0;
          return (
            <TypeChip
              key={t}
              label={`${ACTIVITY_LABELS[t]} · ${count}`}
              active={typeFilter === t}
              dimmed={count === 0}
              onClick={() => setTypeFilter(t)}
            />
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="text-muted text-sm">
          {rows.length === 0
            ? `No activities logged on ${date}.`
            : `No ${ACTIVITY_LABELS[typeFilter as ActivityType].toLowerCase()} on ${date}.`}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-paper">
          <table className="w-full text-sm">
            <thead className="bg-paper-2 text-muted text-xs uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2 text-left">Time</th>
                <th className="px-3 py-2 text-left">Animal</th>
                <th className="px-3 py-2 text-left">Activity</th>
                <th className="px-3 py-2 text-left">By</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-line border-t">
                  <td className="px-3 py-2 font-mono text-xs">{clockTime(r.occurredAt)}</td>
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

interface ChipProps {
  label: string;
  active: boolean;
  dimmed?: boolean;
  onClick: () => void;
}

function TypeChip({ label, active, dimmed, onClick }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 font-semibold text-[12px] transition ${
        active
          ? 'border-accent bg-accent text-accent-fg'
          : `border-line bg-paper text-muted hover:bg-paper-2 ${dimmed ? 'opacity-50' : ''}`
      }`}
    >
      {label}
    </button>
  );
}
