'use client';
import type { AnimalStatus } from '@prisma/client';
import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

type StatusFilter = 'ALL' | AnimalStatus;

const STATUS_CHIPS: { id: StatusFilter; label: string }[] = [
  { id: 'ALL', label: 'All' },
  { id: 'CRITICAL', label: 'Critical' },
  { id: 'STABLE', label: 'Stable' },
  { id: 'OBSERVATION', label: 'Observation' },
];

const SPECIES_CHIPS = ['All', 'Dog', 'Cat', 'Cow', 'Bird'] as const;

interface Props {
  initialSearch: string;
  initialStatus: StatusFilter;
  initialSpecies: string;
}

export function PatientListFilters({ initialSearch, initialStatus, initialSpecies }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState(initialSearch);
  // Avoid re-syncing the URL when search hasn't actually changed (e.g. when
  // a chip click triggers a re-render that bumps `params` — we don't want
  // the search-debounce effect to fight the chip click).
  const lastSyncedSearch = useRef(initialSearch);

  useEffect(() => {
    if (search === lastSyncedSearch.current) return;
    const handle = setTimeout(() => {
      const next = new URLSearchParams(window.location.search);
      if (search) next.set('q', search);
      else next.delete('q');
      lastSyncedSearch.current = search;
      const qs = next.toString();
      router.replace(qs ? `/patients?${qs}` : '/patients');
    }, 200);
    return () => clearTimeout(handle);
  }, [search, router]);

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(window.location.search);
    if (value && value !== 'ALL' && value !== 'All') next.set(key, value);
    else next.delete(key);
    const qs = next.toString();
    router.replace(qs ? `/patients?${qs}` : '/patients');
  };

  return (
    <div className="flex flex-col gap-2.5">
      <label className="relative block">
        <Search size={16} className="-translate-y-1/2 absolute top-1/2 left-3 text-soft" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, breed, ward…"
          className="h-10 w-full rounded-xl border border-line bg-paper pr-3 pl-9 text-[14px] placeholder:text-soft focus:border-accent focus:outline-none"
        />
      </label>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10.5px] text-soft uppercase tracking-[0.06em]">Status</span>
        {STATUS_CHIPS.map((s) => (
          <Chip
            key={s.id}
            label={s.label}
            active={initialStatus === s.id}
            onClick={() => setParam('status', s.id)}
          />
        ))}
        <span className="ml-2 text-[10.5px] text-soft uppercase tracking-[0.06em]">Species</span>
        {SPECIES_CHIPS.map((s) => (
          <Chip
            key={s}
            label={s}
            active={initialSpecies === s || (s === 'All' && !initialSpecies)}
            onClick={() => setParam('species', s)}
          />
        ))}
      </div>
    </div>
  );
}

interface ChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

function Chip({ label, active, onClick }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 font-semibold text-[12px] transition ${
        active ? 'border-accent bg-accent text-accent-fg' : 'border-line bg-paper text-muted hover:bg-paper-2'
      }`}
    >
      {label}
    </button>
  );
}
