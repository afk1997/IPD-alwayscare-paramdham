import { listTodayAdmissions, listTodayDeaths, listTodayDischarges } from '@/features/outcomes/queries';
import { formatDateTime } from '@/lib/time';
import Link from 'next/link';

const LOADERS = {
  admissions: listTodayAdmissions,
  deaths: listTodayDeaths,
  discharges: listTodayDischarges,
} as const;

const EMPTY: Record<keyof typeof LOADERS, string> = {
  admissions: 'No admissions today.',
  deaths: 'No deaths today.',
  discharges: 'No discharges today.',
};

export async function TodayLifecyclePanel({ kind }: { kind: keyof typeof LOADERS }) {
  const rows = await LOADERS[kind]();
  if (rows.length === 0) {
    return (
      <p className="rounded-2xl border border-line border-dashed bg-paper p-6 text-center text-muted text-sm">
        {EMPTY[kind]}
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r) => (
        <li key={r.id} className="rounded-lg border border-line bg-paper p-3">
          <Link href={`/patients/${r.id}`} className="block hover:opacity-80">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="font-medium">{r.name}</span>
              <span className="text-muted text-xs">{r.species}</span>
              <span className="ml-auto text-muted text-xs">{formatDateTime(r.at)}</span>
            </div>
            {r.detail && <p className="mt-1 text-[13px] text-text">{r.detail}</p>}
            {r.byName && <p className="mt-0.5 text-[11px] text-soft">by {r.byName}</p>}
          </Link>
        </li>
      ))}
    </ul>
  );
}
