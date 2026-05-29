'use client';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { PatientCard } from '@/features/animals/components/PatientCard';
import type { AnimalListItem } from '@/features/animals/queries';
import { formatDateTime } from '@/lib/time';
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
  cards: AnimalListItem[];
}

type Tab = 'deaths' | 'discharges';

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
  );
}

function Group({
  title,
  rows,
  byId,
}: { title: string; rows: OutcomeRow[]; byId: Map<string, AnimalListItem> }) {
  return (
    <div>
      <h3 className="mb-2 px-1 font-display text-[13px] font-bold">{title}</h3>
      <ul className="flex flex-col gap-2">
        {rows.map((r) => {
          const card = byId.get(r.animalId);
          if (!card) return null;
          return (
            <li key={r.animalId}>
              <PatientCard animal={card} />
              <p className="mt-1 px-3 text-[12.5px] text-muted">
                {r.detail} · {formatDateTime(new Date(r.at))} · by {r.byName}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function List({ rows, verb, byId }: { rows: OutcomeRow[]; verb: string; byId: Map<string, AnimalListItem> }) {
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
      {today.length > 0 && <Group title="Today" rows={today} byId={byId} />}
      {earlier.length > 0 && <Group title="Earlier" rows={earlier} byId={byId} />}
    </div>
  );
}

export function OutcomesTabs({ deaths, discharges, cards }: Props) {
  const [tab, setTab] = useState<Tab>('deaths');
  const byId = new Map(cards.map((c) => [c.id, c]));
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
      {tab === 'deaths' ? (
        <List rows={deaths} verb="deaths" byId={byId} />
      ) : (
        <List rows={discharges} verb="discharges" byId={byId} />
      )}
    </div>
  );
}
