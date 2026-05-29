'use client';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { formatDateTime } from '@/lib/time';
import Link from 'next/link';
import { useState } from 'react';

export interface OutcomeRow {
  animalId: string;
  animalName: string;
  animalSpecies: string;
  detail: string;
  at: string;
  byName: string;
}

interface Props {
  deaths: OutcomeRow[];
  discharges: OutcomeRow[];
}

type Tab = 'deaths' | 'discharges';

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
  );
}

function Group({ title, rows }: { title: string; rows: OutcomeRow[] }) {
  return (
    <div>
      <h3 className="mb-2 px-1 font-display text-[13px] font-bold">{title}</h3>
      <ul className="flex flex-col gap-2">
        {rows.map((r) => (
          <li key={r.animalId} className="rounded-lg border border-line bg-paper p-3">
            <Link href={`/patients/${r.animalId}`} className="block hover:opacity-80">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-medium">{r.animalName}</span>
                <span className="text-muted text-xs">{r.animalSpecies}</span>
                <span className="ml-auto text-muted text-xs">{formatDateTime(new Date(r.at))}</span>
              </div>
              <p className="mt-1 text-[13px] text-text">{r.detail}</p>
              <p className="mt-0.5 text-[11px] text-soft">by {r.byName}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function List({ rows, verb }: { rows: OutcomeRow[]; verb: string }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-line bg-paper p-6 text-center text-muted text-sm">
        No {verb} recorded.
      </p>
    );
  }
  const today = rows.filter((r) => isToday(r.at));
  const earlier = rows.filter((r) => !isToday(r.at));
  return (
    <div className="flex flex-col gap-4">
      {today.length > 0 && <Group title="Today" rows={today} />}
      {earlier.length > 0 && <Group title="Earlier" rows={earlier} />}
    </div>
  );
}

export function OutcomesTabs({ deaths, discharges }: Props) {
  const [tab, setTab] = useState<Tab>('deaths');
  return (
    <div className="flex flex-col gap-4">
      <SegmentedTabs
        value={tab}
        onChange={setTab}
        options={[
          { value: 'deaths', label: 'Deaths', count: deaths.length },
          { value: 'discharges', label: 'Discharges', count: discharges.length },
        ]}
      />
      {tab === 'deaths' ? <List rows={deaths} verb="deaths" /> : <List rows={discharges} verb="discharges" />}
    </div>
  );
}
