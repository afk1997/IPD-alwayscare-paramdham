'use client';
import { type ActivitySearchResult, searchActivitiesAction } from '@/features/activities/actions';
import { ACTIVITY_LABELS, type ActivityType } from '@/features/activities/schema';
import { searchAnimalsAction } from '@/features/animals/actions';
import type { ActiveAnimalLite } from '@/features/animals/queries';
import { useBodyScrollLock } from '@/lib/hooks/useBodyScrollLock';
import { Activity as ActivityIcon, PawPrint, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

interface CommandPaletteContextValue {
  open: () => void;
  close: () => void;
  isOpen: boolean;
}

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);

export function useCommandPalette(): CommandPaletteContextValue {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx) throw new Error('useCommandPalette must be used inside CommandPaletteProvider');
  return ctx;
}

interface Props {
  children: React.ReactNode;
}

export function CommandPaletteProvider({ children }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  useBodyScrollLock(isOpen);

  // Global ⌘K / Ctrl+K opens the palette.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen((cur) => !cur);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const value = useMemo(() => ({ isOpen, open, close }), [isOpen, open, close]);

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
      {isOpen && <Palette onClose={close} />}
    </CommandPaletteContext.Provider>
  );
}

interface PaletteProps {
  onClose: () => void;
}

function Palette({ onClose }: PaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [patients, setPatients] = useState<ActiveAnimalLite[]>([]);
  const [activities, setActivities] = useState<ActivitySearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Debounced double-query.  Patient search runs even on empty string;
  // activity search only kicks in for ≥2 chars (it scans remarks).
  useEffect(() => {
    const handle = setTimeout(async () => {
      const [p, a] = await Promise.all([
        searchAnimalsAction(query),
        query.trim().length >= 2 ? searchActivitiesAction(query) : Promise.resolve([]),
      ]);
      setPatients(p);
      setActivities(a);
      setSelectedIndex(0);
    }, 150);
    return () => clearTimeout(handle);
  }, [query]);

  const results: Result[] = useMemo(() => {
    const out: Result[] = [];
    for (const p of patients) {
      out.push({ kind: 'patient', id: p.id, label: p.name, sub: p.species, href: `/patients/${p.id}` });
    }
    for (const a of activities) {
      out.push({
        kind: 'activity',
        id: a.id,
        label: a.animalName,
        sub: `${ACTIVITY_LABELS[a.type as ActivityType] ?? a.type}${a.remarks ? ` · ${a.remarks}` : ''}`,
        href: `/patients/${a.animalId}`,
      });
    }
    return out.slice(0, 12);
  }, [patients, activities]);

  const choose = useCallback(
    (r: Result) => {
      onClose();
      router.push(r.href);
    },
    [onClose, router],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(0, i - 1));
      }
      if (e.key === 'Enter' && results[selectedIndex]) {
        e.preventDefault();
        choose(results[selectedIndex]);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [results, selectedIndex, onClose, choose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/45 backdrop-blur-[1px]"
      />
      <div className="relative w-full max-w-[540px] overflow-hidden rounded-2xl border border-line bg-paper shadow-xl">
        <label className="flex items-center gap-2 border-line border-b px-4">
          <Search size={16} className="text-soft" />
          <input
            type="text"
            // biome-ignore lint/a11y/noAutofocus: command palettes need immediate keyboard focus
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search patients, activities…"
            className="h-12 flex-1 bg-transparent text-[14px] placeholder:text-soft focus:outline-none"
          />
          <kbd className="rounded border border-line bg-paper-2 px-1.5 py-0.5 font-mono text-[10px] text-soft">
            esc
          </kbd>
        </label>
        <div className="max-h-[60vh] overflow-y-auto py-1">
          {results.length === 0 && (
            <p className="px-4 py-6 text-center text-[12.5px] text-muted">
              {query
                ? 'No matches. Try a name, breed, or activity note.'
                : 'Type to find patients or activities.'}
            </p>
          )}
          {results.map((r, idx) => {
            const Icon = r.kind === 'patient' ? PawPrint : ActivityIcon;
            const active = idx === selectedIndex;
            return (
              <button
                key={`${r.kind}-${r.id}`}
                type="button"
                onClick={() => choose(r)}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition ${
                  active ? 'bg-paper-2' : ''
                }`}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent-ink">
                  <Icon size={13} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display font-semibold text-[13.5px]">{r.label}</span>
                  <span className="block truncate text-[11.5px] text-muted">{r.sub}</span>
                </span>
                <span className="text-[10.5px] text-soft uppercase tracking-wide">{r.kind}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

type Result = {
  kind: 'patient' | 'activity';
  id: string;
  label: string;
  sub: string;
  href: string;
};
