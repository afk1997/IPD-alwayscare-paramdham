'use client';
import { Button } from '@/components/ui/Button';
import { useState, useTransition } from 'react';
import {
  restoreActivityFromTrashAction,
  restoreAnimalFromTrashAction,
  restoreDocumentFromTrashAction,
} from '../actions';
import type { TrashActivityRow, TrashAnimalRow, TrashDocumentRow } from '../queries';

type Tab = 'activities' | 'documents' | 'animals';

interface Props {
  initialTab: Tab;
  counts: { activities: number; documents: number; animals: number };
  activities: TrashActivityRow[];
  documents: TrashDocumentRow[];
  animals: TrashAnimalRow[];
}

function timeAgo(d: Date) {
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
}

export function TrashTabs({ initialTab, counts, activities, documents, animals }: Props) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const restore = (kind: Tab, id: string) => {
    setError(null);
    start(async () => {
      const action =
        kind === 'activities'
          ? restoreActivityFromTrashAction
          : kind === 'documents'
            ? restoreDocumentFromTrashAction
            : restoreAnimalFromTrashAction;
      const r = await action(id);
      if (!r.ok) setError(r.error ?? 'Restore failed');
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Trash" className="flex gap-2 border-b border-line">
        {(['activities', 'documents', 'animals'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              tab === t ? 'border-accent text-text' : 'border-transparent text-muted hover:text-text'
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}{' '}
            <span className="ml-1 rounded bg-paper-2 px-1.5 py-0.5 text-xs text-muted">{counts[t]}</span>
          </button>
        ))}
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-md border border-critical bg-critical-bg px-3 py-2 text-sm text-critical"
        >
          {error}
        </div>
      )}

      {tab === 'activities' && (
        <ActivityList rows={activities} pending={pending} onRestore={(id) => restore('activities', id)} />
      )}
      {tab === 'documents' && (
        <DocumentList rows={documents} pending={pending} onRestore={(id) => restore('documents', id)} />
      )}
      {tab === 'animals' && (
        <AnimalList rows={animals} pending={pending} onRestore={(id) => restore('animals', id)} />
      )}
    </div>
  );
}

function EmptyRow({ label }: { label: string }) {
  return <p className="rounded-lg border border-line bg-paper p-6 text-center text-sm text-muted">{label}</p>;
}

interface ListProps<T> {
  rows: T[];
  pending: boolean;
  onRestore: (id: string) => void;
}

function ActivityList({ rows, pending, onRestore }: ListProps<TrashActivityRow>) {
  if (rows.length === 0) return <EmptyRow label="No deleted activities." />;
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r) => (
        <li
          key={r.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-paper p-3"
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="font-medium">{r.type}</span>
              {r.animal && (
                <span className="text-muted text-xs">
                  · {r.animal.name} ({r.animal.species})
                </span>
              )}
            </div>
            <div className="truncate text-muted text-xs">
              by {r.byName} · deleted {timeAgo(r.deletedAt)}
              {r.deletedByName ? ` by ${r.deletedByName}` : ''}
            </div>
          </div>
          <Button type="button" disabled={pending} onClick={() => onRestore(r.id)}>
            Restore
          </Button>
        </li>
      ))}
    </ul>
  );
}

function DocumentList({ rows, pending, onRestore }: ListProps<TrashDocumentRow>) {
  if (rows.length === 0) return <EmptyRow label="No deleted documents." />;
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r) => (
        <li
          key={r.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-paper p-3"
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="font-medium">{r.kind}</span>
              <span className="text-muted text-xs">· {r.category}</span>
              {r.animal && (
                <span className="text-muted text-xs">
                  · {r.animal.name} ({r.animal.species})
                </span>
              )}
            </div>
            <div className="truncate text-muted text-xs">
              {r.name} · deleted {timeAgo(r.deletedAt)}
              {r.deletedByName ? ` by ${r.deletedByName}` : ''}
            </div>
          </div>
          <Button type="button" disabled={pending} onClick={() => onRestore(r.id)}>
            Restore
          </Button>
        </li>
      ))}
    </ul>
  );
}

function AnimalList({ rows, pending, onRestore }: ListProps<TrashAnimalRow>) {
  if (rows.length === 0) return <EmptyRow label="No deleted patients." />;
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r) => (
        <li
          key={r.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-paper p-3"
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="font-medium">{r.name}</span>
              <span className="text-muted text-xs">
                · {r.species} · {r.status}
              </span>
            </div>
            <div className="truncate text-muted text-xs">
              admitted {r.admittedAt.toISOString().slice(0, 10)} · deleted {timeAgo(r.deletedAt)}
              {r.deletedByName ? ` by ${r.deletedByName}` : ''}
            </div>
          </div>
          <Button type="button" disabled={pending} onClick={() => onRestore(r.id)}>
            Restore
          </Button>
        </li>
      ))}
    </ul>
  );
}
