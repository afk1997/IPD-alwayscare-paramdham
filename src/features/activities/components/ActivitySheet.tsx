'use client';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { relativeTime } from '@/lib/time';
import { Copy, Pencil, Trash2, X } from 'lucide-react';
import { useEffect, useState, useTransition } from 'react';
import { deleteActivityAction, duplicateActivityAction, updateActivityAction } from '../actions';
import { ACTIVITY_LABELS, type ActivityType } from '../schema';

export interface ActivitySummary {
  id: string;
  animalId: string;
  type: ActivityType;
  occurredAt: Date;
  byName: string;
  remarks: string | null;
  // biome-ignore lint/suspicious/noExplicitAny: server-side data shape is type-erased here
  data: any;
  editedAt: Date | null;
}

interface Props {
  activity: ActivitySummary | null;
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}

type Mode = 'view' | 'edit' | 'confirmDelete';

export function ActivitySheet({ activity, open, onClose, onChanged }: Props) {
  const [mode, setMode] = useState<Mode>('view');
  const [remarks, setRemarks] = useState('');
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && activity) {
      setMode('view');
      setRemarks(activity.remarks ?? '');
      setError(null);
    }
  }, [open, activity]);

  if (!open || !activity) return null;

  const save = () => {
    start(async () => {
      const result = await updateActivityAction(activity.id, activity.animalId, { remarks });
      if (result.ok) {
        setMode('view');
        onChanged();
        onClose();
      } else {
        setError(result.error ?? 'Update failed');
      }
    });
  };

  const del = () => {
    start(async () => {
      const result = await deleteActivityAction(activity.id, activity.animalId);
      if (result.ok) {
        onChanged();
        onClose();
      } else {
        setError(result.error ?? 'Delete failed');
      }
    });
  };

  const dup = () => {
    start(async () => {
      const result = await duplicateActivityAction(activity.id, activity.animalId);
      if (result.ok) {
        onChanged();
        onClose();
      } else {
        setError(result.error ?? 'Duplicate failed');
      }
    });
  };

  return (
    <button
      type="button"
      aria-label="Close"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
      className="fixed inset-0 z-40 flex items-end justify-end bg-black/45 md:items-stretch"
      style={{ animation: 'fadeIn 0.15s ease-out' }}
    >
      {/* biome-ignore lint/a11y/useSemanticElements: nested in a <button> backdrop; HTML <dialog> would create invalid nesting */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ACTIVITY_LABELS[activity.type]}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        className="flex h-[88vh] w-full max-w-[560px] flex-col overflow-hidden rounded-t-2xl bg-paper shadow-xl md:h-full md:max-h-none md:rounded-none md:border-l md:border-line"
        style={{
          animation:
            typeof window !== 'undefined' && window.innerWidth < 768
              ? 'slideUp 0.25s ease-out'
              : 'slideInLeft 0.22s ease-out',
        }}
      >
        <header className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-3">
          <div className="flex flex-1 flex-col">
            <h2 className="font-display text-base font-bold">{ACTIVITY_LABELS[activity.type]}</h2>
            <p className="text-xs text-muted">
              {new Date(activity.occurredAt).toLocaleString()} · by {activity.byName}
              {activity.editedAt && ` · edited ${relativeTime(activity.editedAt)}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-md text-muted hover:bg-paper-2"
          >
            <X size={16} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4">
          {mode === 'view' && <ActivityViewer activity={activity} />}
          {mode === 'edit' && (
            <div className="flex flex-col gap-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted">Remarks</div>
              <Textarea rows={5} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
              <p className="text-xs text-muted">
                Detailed field editing per activity type is coming in a later pass — for now you can update
                remarks.
              </p>
            </div>
          )}
          {mode === 'confirmDelete' && (
            <div className="flex flex-col gap-3">
              <div className="font-display text-base font-semibold">
                Delete this {ACTIVITY_LABELS[activity.type].toLowerCase()}?
              </div>
              <p className="text-sm text-muted">
                Soft delete — it can be restored from the audit log by an admin.
              </p>
            </div>
          )}
          {error && <div className="mt-3 text-sm text-critical">{error}</div>}
        </div>

        <footer className="flex shrink-0 items-center gap-2 border-t border-line p-3">
          {mode === 'view' && (
            <>
              <Button variant="ghost" size="sm" onClick={() => setMode('edit')} disabled={pending}>
                <Pencil size={14} />
                Edit
              </Button>
              <Button variant="ghost" size="sm" onClick={dup} disabled={pending}>
                <Copy size={14} />
                Duplicate
              </Button>
              <div className="flex-1" />
              <Button variant="danger" size="sm" onClick={() => setMode('confirmDelete')} disabled={pending}>
                <Trash2 size={14} />
                Delete
              </Button>
            </>
          )}
          {mode === 'edit' && (
            <>
              <Button variant="ghost" size="sm" onClick={() => setMode('view')} disabled={pending}>
                Cancel
              </Button>
              <div className="flex-1" />
              <Button size="sm" onClick={save} disabled={pending}>
                {pending ? 'Saving…' : 'Save'}
              </Button>
            </>
          )}
          {mode === 'confirmDelete' && (
            <>
              <Button variant="ghost" size="sm" onClick={() => setMode('view')} disabled={pending}>
                Cancel
              </Button>
              <div className="flex-1" />
              <Button variant="danger" size="sm" onClick={del} disabled={pending}>
                {pending ? 'Deleting…' : 'Yes, delete'}
              </Button>
            </>
          )}
        </footer>
      </div>
    </button>
  );
}

function ActivityViewer({ activity }: { activity: ActivitySummary }) {
  const data = activity.data as Record<string, unknown> | null;
  return (
    <div className="flex flex-col gap-4 text-sm">
      {data ? renderFields(activity.type, data) : null}
      {activity.remarks && (
        <Field label="Remarks">
          <p>{activity.remarks}</p>
        </Field>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-soft">{label}</div>
      <div className="mt-1 text-sm text-text">{children}</div>
    </div>
  );
}

function renderFields(type: ActivityType, data: Record<string, unknown>): React.ReactNode {
  if (type === 'TREATMENT') {
    const meds = (data.meds ?? []) as Array<{ name: string; dose: string; route: string }>;
    return (
      <Field label="Medicines">
        <ul className="flex flex-col gap-1 font-mono text-xs">
          {meds.map((m) => (
            <li key={`${m.name}-${m.dose}-${m.route}`}>
              {m.name} · {m.dose} · {m.route}
            </li>
          ))}
        </ul>
      </Field>
    );
  }
  return (
    <>
      {Object.entries(data).map(([k, v]) => {
        if (v === null || v === undefined || v === '' || v === false) return null;
        const display = Array.isArray(v) ? v.join(', ') : String(v);
        return (
          <Field key={k} label={k}>
            {display}
          </Field>
        );
      })}
    </>
  );
}
