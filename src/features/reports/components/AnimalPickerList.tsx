'use client';
import { Pill } from '@/components/ui/Pill';
import { searchAnimalsAction } from '@/features/animals/actions';
import type { ActiveAnimalLite } from '@/features/animals/queries';
import { Search } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';

interface Props {
  selectedId: string | null;
}

const LIST_CAP = 50;

export function AnimalPickerList({ selectedId }: Props) {
  const [query, setQuery] = useState('');
  const [includePast, setIncludePast] = useState(false);
  const [results, setResults] = useState<ActiveAnimalLite[]>([]);
  const [, start] = useTransition();

  useEffect(() => {
    const t = setTimeout(() => {
      start(async () => {
        const rows = await searchAnimalsAction(query, includePast);
        setResults(rows);
      });
    }, 180);
    return () => clearTimeout(t);
  }, [query, includePast]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative block max-w-md flex-1">
          <Search size={16} className="-translate-y-1/2 absolute top-1/2 left-3 text-soft" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by animal name…"
            className="h-10 w-full rounded-xl border border-line bg-paper pr-3 pl-9 text-[14px] placeholder:text-soft focus:border-accent focus:outline-none"
          />
        </label>
        <label className="flex items-center gap-2 text-[12.5px] text-muted">
          <input
            type="checkbox"
            checked={includePast}
            onChange={(e) => setIncludePast(e.target.checked)}
            className="h-4 w-4 rounded border-line text-accent focus:ring-accent"
          />
          Show past patients
        </label>
      </div>

      {results.length === 0 ? (
        <p className="text-[12.5px] text-muted">
          {query ? `No matches for "${query}".` : includePast ? 'No patients.' : 'No active patients.'}
        </p>
      ) : (
        <ul className="flex flex-col rounded-2xl border border-line bg-paper">
          {results.map((r, idx) => {
            const tone: 'critical' | 'stable' | 'neutral' =
              r.status === 'DECEASED' ? 'critical' : r.status === 'DISCHARGED' ? 'neutral' : 'stable';
            const label =
              r.status === 'DECEASED' ? 'Deceased' : r.status === 'DISCHARGED' ? 'Discharged' : 'Admitted';
            const isSelected = r.id === selectedId;
            return (
              <li key={r.id} className={idx > 0 ? 'border-line border-t' : ''}>
                <Link
                  href={`/reports/by-animal?animalId=${r.id}`}
                  className={`flex items-center justify-between px-3 py-2.5 transition hover:bg-paper-2 ${
                    isSelected ? 'bg-accent-soft' : ''
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="font-display font-semibold text-[14px]">{r.name}</span>
                    <span className="text-[11.5px] text-muted">
                      {r.species}
                      {r.ward ? ` · ${r.ward}` : ''}
                    </span>
                  </div>
                  <Pill status={tone}>{label}</Pill>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {results.length === LIST_CAP && (
        <p className="text-[12px] text-soft">Showing first {LIST_CAP} — refine your search to narrow.</p>
      )}
    </div>
  );
}
