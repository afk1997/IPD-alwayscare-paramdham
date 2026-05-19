'use client';
import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { DOC_CATEGORIES, DOC_CATEGORY_LABELS, type DocCategory } from '../schema';

type CategoryFilter = 'ALL' | DocCategory;

interface Props {
  initialSearch: string;
  initialCategory: CategoryFilter;
}

export function DocumentsFilters({ initialSearch, initialCategory }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState(initialSearch);
  const lastSyncedSearch = useRef(initialSearch);

  useEffect(() => {
    if (search === lastSyncedSearch.current) return;
    const handle = setTimeout(() => {
      const next = new URLSearchParams(window.location.search);
      if (search) next.set('q', search);
      else next.delete('q');
      lastSyncedSearch.current = search;
      const qs = next.toString();
      router.replace(qs ? `/documents?${qs}` : '/documents');
    }, 200);
    return () => clearTimeout(handle);
  }, [search, router]);

  const setCategory = (cat: CategoryFilter) => {
    const next = new URLSearchParams(window.location.search);
    if (cat !== 'ALL') next.set('category', cat);
    else next.delete('category');
    const qs = next.toString();
    router.replace(qs ? `/documents?${qs}` : '/documents');
  };

  return (
    <div className="flex flex-col gap-2.5">
      <label className="relative block">
        <Search size={16} className="-translate-y-1/2 absolute top-1/2 left-3 text-soft" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search file, animal, type…"
          className="h-10 w-full rounded-xl border border-line bg-paper pr-3 pl-9 text-[14px] placeholder:text-soft focus:border-accent focus:outline-none"
        />
      </label>
      <div className="flex flex-wrap gap-1.5">
        <Chip label="All" active={initialCategory === 'ALL'} onClick={() => setCategory('ALL')} />
        {DOC_CATEGORIES.map((c) => (
          <Chip
            key={c}
            label={DOC_CATEGORY_LABELS[c]}
            active={initialCategory === c}
            onClick={() => setCategory(c)}
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
