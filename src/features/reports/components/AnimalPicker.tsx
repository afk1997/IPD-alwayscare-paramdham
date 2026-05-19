'use client';
import { searchAnimalsAction } from '@/features/animals/actions';
import type { ActiveAnimalLite } from '@/features/animals/queries';
import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

interface Props {
  selectedId: string | null;
}

export function AnimalPicker({ selectedId }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ActiveAnimalLite[]>([]);
  const [, start] = useTransition();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      start(async () => {
        const rows = await searchAnimalsAction(query);
        setResults(rows);
      });
    }, 180);
    return () => clearTimeout(t);
  }, [query]);

  const selected = results.find((r) => r.id === selectedId);

  const pick = (id: string) => {
    setOpen(false);
    router.push(`/reports/by-animal?animalId=${id}`);
  };

  return (
    <div className="relative max-w-md">
      <label className="relative block">
        <Search size={16} className="-translate-y-1/2 absolute top-1/2 left-3 text-soft" />
        <input
          type="text"
          value={open ? query : (selected?.name ?? query)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search by animal name…"
          className="h-10 w-full rounded-xl border border-line bg-paper pr-3 pl-9 text-[14px] placeholder:text-soft focus:border-accent focus:outline-none"
        />
      </label>
      {open && (
        <ul className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-line bg-paper shadow-lg">
          {results.length === 0 && (
            <li className="px-3 py-3 text-[12.5px] text-muted">No active patients match.</li>
          )}
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => pick(r.id)}
                className="flex w-full items-center justify-between px-3 py-2 text-left transition hover:bg-paper-2"
              >
                <span className="font-display font-semibold text-[14px]">{r.name}</span>
                <span className="text-[12px] text-muted">
                  {r.species}
                  {r.ward ? ` · ${r.ward}` : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
