'use client';
import { Photo } from '@/components/media/Photo';
import { Pill } from '@/components/ui/Pill';
import { searchAnimalsAction } from '@/features/animals/actions';
import type { ActiveAnimalLite } from '@/features/animals/queries';
import type { AnimalStatus } from '@prisma/client';
import { ChevronRight, Search } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';

const STATUS_TONE: Record<AnimalStatus, 'critical' | 'stable' | 'observation' | 'neutral'> = {
  CRITICAL: 'critical',
  STABLE: 'stable',
  OBSERVATION: 'observation',
  DISCHARGED: 'neutral',
  DECEASED: 'neutral',
};

const STATUS_LABELS: Record<AnimalStatus, string> = {
  CRITICAL: 'Critical',
  STABLE: 'Stable',
  OBSERVATION: 'Observation',
  DISCHARGED: 'Discharged',
  DECEASED: 'Deceased',
};

interface Props {
  onPick: (animal: ActiveAnimalLite) => void;
  onCancel: () => void;
}

export function PatientPicker({ onPick, onCancel }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ActiveAnimalLite[]>([]);
  const [pending, start] = useTransition();
  const [initialised, setInitialised] = useState(false);

  useEffect(() => {
    const t = setTimeout(
      () => {
        start(async () => {
          const rows = await searchAnimalsAction(query);
          setResults(rows);
          setInitialised(true);
        });
      },
      query ? 180 : 0,
    );
    return () => clearTimeout(t);
  }, [query]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <label className="relative flex items-center">
        <Search size={16} className="-translate-y-1/2 absolute top-1/2 left-3 text-soft" />
        <input
          type="text"
          // biome-ignore lint/a11y/noAutofocus: opening modal needs immediate keyboard focus on search
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, species, ward…"
          className="h-10 w-full rounded-xl border border-line bg-paper pr-3 pl-9 text-[14px] placeholder:text-soft focus:border-accent focus:outline-none"
        />
      </label>

      <div className="-mx-1 flex max-h-[420px] min-h-[120px] flex-1 flex-col overflow-y-auto px-1">
        {!initialised && pending && (
          <div className="grid place-items-center py-10 text-[12.5px] text-muted">Loading…</div>
        )}
        {initialised && results.length === 0 && (
          <div className="grid place-items-center gap-2 py-8 text-center">
            <p className="text-[13px] text-muted">{query ? 'No matches.' : 'No active patients yet.'}</p>
            <Link
              href="/patients/new"
              onClick={onCancel}
              className="text-[12.5px] font-semibold text-accent hover:underline"
            >
              Admit a new animal →
            </Link>
          </div>
        )}
        {results.map((a) => (
          <button
            type="button"
            key={a.id}
            onClick={() => onPick(a)}
            className="flex items-center gap-3 rounded-xl border border-transparent px-2 py-2 text-left transition hover:border-line hover:bg-paper-2"
          >
            <Photo seed={a.id} alt={a.name} rounded={12} className="h-10 w-10 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-display font-semibold text-[14px]">{a.name}</span>
              <span className="mt-0.5 block truncate text-[12px] text-muted">
                {a.species}
                {a.ward ? ` · ${a.ward}` : ''}
              </span>
            </span>
            <Pill status={STATUS_TONE[a.status]}>{STATUS_LABELS[a.status]}</Pill>
            <ChevronRight size={14} className="shrink-0 text-soft" />
          </button>
        ))}
      </div>
    </div>
  );
}
