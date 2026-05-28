'use client';
import { Lightbox } from '@/components/media/Lightbox';
import { Photo } from '@/components/media/Photo';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useActiveUsers } from '@/features/users/ActiveUsersContext';
import { copyToClipboard } from '@/lib/clipboard';
import { useFocusTrap } from '@/lib/hooks/useFocusTrap';
import { useSwipeDown } from '@/lib/hooks/useSwipeDown';
import { formatDateTime, relativeTime } from '@/lib/time';
import { Copy, Pencil, Share2, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState, useTransition } from 'react';
import {
  deleteActivityAction,
  duplicateActivityAction,
  getActivityShareTextAction,
  restoreActivityAction,
  updateActivityAction,
} from '../actions';
import { ACTIVITY_LABELS, type ActivityType } from '../schema';
import type { SerializedActivity } from '../serialized';
import { summarizeActivity } from '../summary';
import { ActivityEditFields, type EditDraft, toLocalDatetime } from './ActivityEditFields';

function buildOptimisticUpdate(
  activity: ActivitySummary,
  draft: EditDraft,
  media: SerializedActivity['media'],
): SerializedActivity {
  const occurredAtISO = draft.occurredAtLocal
    ? new Date(draft.occurredAtLocal).toISOString()
    : activity.occurredAt.toISOString();
  return {
    id: activity.id,
    animalId: activity.animalId,
    type: activity.type,
    occurredAt: occurredAtISO,
    byName: draft.byName.trim() || activity.byName,
    remarks: draft.remarks || null,
    editedAt: new Date().toISOString(),
    data: draft.data,
    media,
  };
}

export interface ActivitySummary {
  id: string;
  animalId: string;
  type: ActivityType;
  occurredAt: Date;
  byName: string;
  remarks: string | null;
  // biome-ignore lint/suspicious/noExplicitAny: server-erased shape
  data: any;
  editedAt: Date | null;
  // `kind` is required so the sheet renders <video> for VIDEO assets
  // and <Photo> for PHOTO/XRAY/DOC.  Previously every media tile was
  // rendered as an <img>, which broke for mp4s — the browser showed
  // the placeholder palette colour where the video should play.
  media: {
    id: string;
    assetId: string;
    kind: 'PHOTO' | 'VIDEO' | 'XRAY' | 'DOC';
    label: string | null;
    url: string;
  }[];
}

interface Props {
  activity: ActivitySummary | null;
  open: boolean;
  onClose: () => void;
  onSaved: (next: SerializedActivity) => void;
  onDeleted: (id: string) => void;
  onDuplicated: (next: SerializedActivity) => void;
  onRestored: (next: SerializedActivity) => void;
}

type Mode = 'view' | 'edit' | 'confirmDelete';

const TYPE_COLOR: Record<ActivityType, string> = {
  ADMISSION: '#0E7C7B',
  TREATMENT: '#2563EB',
  ROUND: '#7C3AED',
  DIAGNOSTIC: '#0891B2',
  SURGERY: '#B5471A',
  FOOD: '#15803D',
  BATH: '#0EA5E9',
  WALK: '#A16207',
};

export function ActivitySheet({
  activity,
  open,
  onClose,
  onSaved,
  onDeleted,
  onDuplicated,
  onRestored,
}: Props) {
  const { showToast } = useToast();
  const { currentUserRole } = useActiveUsers();
  const canWrite = currentUserRole !== 'VIEWER';
  const [mode, setMode] = useState<Mode>('view');
  const [draft, setDraft] = useState<EditDraft>({
    remarks: '',
    data: {},
    occurredAtLocal: '',
    byName: '',
  });
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && activity) {
      setMode('view');
      setDraft({
        remarks: activity.remarks ?? '',
        data: cloneDeep(activity.data),
        occurredAtLocal: toLocalDatetime(activity.occurredAt),
        byName: activity.byName,
      });
      setError(null);
    }
  }, [open, activity]);

  const swipe = useSwipeDown({ onClose });
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, open && !!activity);

  if (!open || !activity) return null;

  const save = () => {
    // Snapshot for revert
    const snapshot: SerializedActivity = {
      id: activity.id,
      animalId: activity.animalId,
      type: activity.type,
      occurredAt: activity.occurredAt.toISOString(),
      byName: activity.byName,
      remarks: activity.remarks,
      editedAt: activity.editedAt ? activity.editedAt.toISOString() : null,
      data: activity.data,
      media: activity.media as SerializedActivity['media'],
    };
    const optimistic = buildOptimisticUpdate(activity, draft, activity.media as SerializedActivity['media']);
    // Apply immediately — sheet closes, timeline shows new content
    onSaved(optimistic);
    setMode('view');
    onClose();

    start(async () => {
      try {
        const occurredAtISO = draft.occurredAtLocal
          ? new Date(draft.occurredAtLocal).toISOString()
          : undefined;
        const result = await updateActivityAction(activity.id, {
          remarks: draft.remarks,
          data: draft.data,
          ...(occurredAtISO ? { occurredAt: occurredAtISO } : {}),
          ...(draft.byName.trim() ? { byName: draft.byName.trim() } : {}),
        });
        if (result.ok && result.activity) {
          showToast({ message: `${ACTIVITY_LABELS[activity.type]} updated` });
          // Overlay canonical row over the optimistic one
          onSaved(result.activity);
        } else {
          onSaved(snapshot);
          showToast({ message: result.error ?? 'Update failed — reverted' });
        }
      } catch {
        // The action returns {ok:false} for handled errors, but a transport-
        // level rejection (offline, aborted navigation, 5xx HTML) throws here.
        // Without this catch the optimistic edit would stay applied despite the
        // save having failed. Revert it.
        onSaved(snapshot);
        showToast({ message: 'Update failed — reverted' });
      }
    });
  };

  const del = () => {
    const id = activity.id;
    const typeLabel = ACTIVITY_LABELS[activity.type];
    const snapshot: SerializedActivity = {
      id: activity.id,
      animalId: activity.animalId,
      type: activity.type,
      occurredAt: activity.occurredAt.toISOString(),
      byName: activity.byName,
      remarks: activity.remarks,
      editedAt: activity.editedAt ? activity.editedAt.toISOString() : null,
      data: activity.data,
      media: activity.media as SerializedActivity['media'],
    };
    onDeleted(id);
    onClose();

    start(async () => {
      try {
        const result = await deleteActivityAction(id);
        if (result.ok) {
          showToast({
            message: `${typeLabel} deleted`,
            duration: 12000,
            action: {
              label: 'Undo',
              onClick: async () => {
                try {
                  const r = await restoreActivityAction(id);
                  if (r.ok && r.activity) {
                    onRestored(r.activity);
                  } else {
                    showToast({ message: r.error ?? 'Could not restore — check Trash page' });
                  }
                } catch {
                  showToast({ message: 'Could not restore — check Trash page' });
                }
              },
            },
          });
        } else {
          onRestored(snapshot);
          showToast({ message: result.error ?? 'Delete failed — restored' });
        }
      } catch {
        // Transport-level rejection — re-add the optimistically removed row.
        onRestored(snapshot);
        showToast({ message: 'Delete failed — restored' });
      }
    });
  };

  const share = () => {
    const id = activity.id;
    start(async () => {
      try {
        const result = await getActivityShareTextAction(id);
        if (!result.ok || !result.text) {
          setError(result.error ?? 'Could not prepare share text');
          return;
        }
        await copyToClipboard(result.text, {
          onSuccess: () => showToast({ message: 'Activity copied — paste in WhatsApp / Slack / etc.' }),
          onFallback: () => showToast({ message: 'Activity copied (fallback)' }),
        });
      } catch {
        setError('Could not prepare share text');
      }
    });
  };

  const dup = () => {
    start(async () => {
      try {
        const result = await duplicateActivityAction(activity.id);
        if (result.ok && result.activity) {
          onDuplicated(result.activity);
          onClose();
        } else {
          setError(result.error ?? 'Duplicate failed');
        }
      } catch {
        setError('Duplicate failed');
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-end md:items-stretch"
      style={{ animation: 'fadeIn 0.15s ease-out' }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      {/* Backdrop is a SIBLING button, not a parent — otherwise the Close
          button inside <Header> would be a nested <button>, which is invalid
          HTML and triggers a React hydration warning. */}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/45"
      />
      <div
        ref={dialogRef}
        // biome-ignore lint/a11y/useSemanticElements: pattern shared with QuickAddModal
        role="dialog"
        aria-modal="true"
        aria-label={ACTIVITY_LABELS[activity.type]}
        className="relative flex h-[88vh] w-full max-w-[560px] flex-col overflow-hidden rounded-t-2xl bg-paper shadow-xl md:h-full md:max-h-none md:rounded-none md:border-l md:border-line"
        style={swipe.style}
      >
        {/* Drag-to-dismiss grabber, mobile only. */}
        <div className="flex justify-center py-2 md:hidden" {...swipe.bind}>
          <div className="h-1 w-9 rounded-full bg-line" />
        </div>
        <Header activity={activity} onClose={onClose} />

        <div className="flex-1 overflow-y-auto">
          {mode === 'view' && <ActivityView activity={activity} />}
          {mode === 'edit' && (
            <div className="p-4">
              <ActivityEditFields type={activity.type} value={draft} onChange={setDraft} />
            </div>
          )}
          {mode === 'confirmDelete' && (
            <div className="flex flex-col gap-3 p-5">
              <div className="font-display text-base font-semibold">
                Delete this {ACTIVITY_LABELS[activity.type].toLowerCase()}?
              </div>
              <p className="text-sm text-muted">
                Soft delete — undo is available for a few seconds on the next toast, and an admin can restore
                it later from the Trash page.
              </p>
            </div>
          )}
          {error && (
            <div role="alert" className="px-5 py-2 text-sm text-critical">
              {error}
            </div>
          )}
        </div>

        <footer className="flex shrink-0 items-center gap-2 border-t border-line bg-paper p-3">
          {mode === 'view' && (
            <>
              {canWrite && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setMode('confirmDelete')}
                    disabled={pending}
                  >
                    <Trash2 size={14} />
                    Delete
                  </Button>
                  <Button variant="ghost" size="sm" onClick={dup} disabled={pending}>
                    <Copy size={14} />
                    Duplicate
                  </Button>
                </>
              )}
              <Button variant="ghost" size="sm" onClick={share} disabled={pending}>
                <Share2 size={14} />
                Share
              </Button>
              <div className="flex-1" />
              {canWrite && (
                <Button size="sm" onClick={() => setMode('edit')} disabled={pending}>
                  <Pencil size={14} />
                  Edit
                </Button>
              )}
            </>
          )}
          {mode === 'edit' && (
            <>
              <Button variant="ghost" size="sm" onClick={() => setMode('view')} disabled={pending}>
                Cancel
              </Button>
              <div className="flex-1" />
              <Button size="sm" onClick={save} disabled={pending}>
                {pending ? 'Saving…' : 'Save changes'}
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
    </div>
  );
}

function Header({ activity, onClose }: { activity: ActivitySummary; onClose: () => void }) {
  const color = TYPE_COLOR[activity.type];
  return (
    <header className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-3">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
        style={{ background: `${color}1A`, color }}
      >
        <span className="h-2.5 w-2.5 rounded-full bg-current" />
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="font-display text-base font-bold">{ACTIVITY_LABELS[activity.type]}</h2>
        <p className="mt-0.5 text-[11.5px] text-muted">
          {formatDateTime(activity.occurredAt)} · by {activity.byName}
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
  );
}

function ActivityView({ activity }: { activity: ActivitySummary }) {
  const color = TYPE_COLOR[activity.type];
  const fields = fieldsFor(activity.type, activity.data ?? {});
  const meds = (activity.data?.meds ?? []) as Array<{
    name: string;
    dose: string;
    route: string;
    remarks?: string;
  }>;

  // Tap-to-expand for photos. Videos keep their inline player and are
  // intentionally NOT part of the lightbox carousel — that way swiping
  // inside the lightbox can't unexpectedly land on a video and play
  // full-screen (matches the "videos stay inline" UX choice).
  const photoItems = activity.media
    .filter((m) => m.kind !== 'VIDEO')
    .map((m) => ({ id: m.assetId, filename: m.label ?? '', kind: m.kind, label: m.label, url: m.url }));
  const photoIndexByAssetId = new Map(photoItems.map((p, i) => [p.id, i]));
  const photoCount = photoItems.length;
  const sizesValue =
    photoCount === 1
      ? '(max-width: 560px) 100vw, 560px'
      : photoCount === 2
        ? '(max-width: 560px) 50vw, 280px'
        : '(max-width: 560px) 33vw, 180px';
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  return (
    <div className="flex flex-col gap-4 p-4">
      {activity.media.length > 0 && (
        <div className="grid gap-2" style={mediaGridStyle(activity.media.length)}>
          {activity.media.map((m) =>
            m.kind === 'VIDEO' ? (
              <video
                key={m.id}
                src={m.url}
                controls
                preload="metadata"
                className="aspect-square w-full rounded-[12px] bg-black object-cover"
              >
                <track kind="captions" />
              </video>
            ) : (
              <button
                key={m.id}
                type="button"
                onClick={() => setLightboxIndex(photoIndexByAssetId.get(m.assetId) ?? 0)}
                aria-label="Open photo"
                className="cursor-zoom-in overflow-hidden rounded-[12px] outline-offset-2 focus-visible:outline-2 focus-visible:outline-accent"
              >
                <Photo
                  src={m.url}
                  seed={m.assetId}
                  kind={m.kind === 'XRAY' ? 'xray' : m.kind === 'DOC' ? 'doc' : 'photo'}
                  alt={m.label ?? ''}
                  rounded={12}
                  className="aspect-square w-full"
                  sizes={sizesValue}
                />
              </button>
            ),
          )}
        </div>
      )}

      <div
        className="rounded-xl px-3.5 py-3 text-[14px] font-medium leading-snug"
        style={{ background: `${color}14`, borderLeft: `3px solid ${color}` }}
      >
        {summarizeActivity(activity)}
      </div>

      {activity.type === 'TREATMENT' && meds.length > 0 && (
        <Section label={`Medicines · ${meds.length}`}>
          <ul className="overflow-hidden rounded-xl border border-line">
            {meds.map((m, i) => (
              <li
                key={`${m.name}-${m.dose}-${m.route}-${i}`}
                className={`flex items-center gap-3 px-3 py-2.5 ${i > 0 ? 'border-t border-line' : ''}`}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-soft font-bold text-[12px] text-accent-ink">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-[13.5px]">{m.name || '—'}</div>
                  <div className="text-[12px] text-muted">
                    {[m.dose, m.route].filter(Boolean).join(' · ')}
                    {m.remarks ? ` — ${m.remarks}` : ''}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {fields.length > 0 && (
        <Section label="Details">
          <div className="rounded-xl border border-line">
            {fields.map((f, i) => (
              <div key={f.label} className={`px-3 py-2.5 ${i > 0 ? 'border-t border-line' : ''}`}>
                <div className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-muted">
                  {f.label}
                </div>
                <div className="mt-1 whitespace-pre-wrap text-[13.5px] text-text">{f.value}</div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {activity.remarks && activity.type !== 'TREATMENT' && (
        <Section label="Remarks">
          <p className="text-[13.5px] text-text">{activity.remarks}</p>
        </Section>
      )}

      <Section label="Audit">
        <div className="rounded-xl border border-line">
          <KV k="Logged by" v={activity.byName} />
          <KV k="Logged at" v={formatDateTime(activity.occurredAt)} />
          {activity.editedAt && <KV k="Last edited" v={relativeTime(activity.editedAt)} />}
        </div>
      </Section>
      <Lightbox
        items={photoItems}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onChange={setLightboxIndex}
      />
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[10.5px] font-bold uppercase tracking-[0.07em] text-muted">{label}</div>
      {children}
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5 [&:not(:first-child)]:border-t [&:not(:first-child)]:border-line">
      <span className="text-[11.5px] font-semibold uppercase tracking-[0.05em] text-muted">{k}</span>
      <span className="text-[13px] text-text">{v}</span>
    </div>
  );
}

function mediaGridStyle(n: number): React.CSSProperties {
  if (n === 1) return { gridTemplateColumns: '1fr' };
  if (n === 2) return { gridTemplateColumns: '1fr 1fr' };
  return { gridTemplateColumns: 'repeat(3, 1fr)' };
}

function cloneDeep<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

interface DisplayField {
  label: string;
  value: string;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: per-type field list builder
function fieldsFor(type: ActivityType, data: Record<string, unknown>): DisplayField[] {
  const out: DisplayField[] = [];
  const push = (label: string, value: unknown) => {
    if (value === undefined || value === null || value === '' || value === false) return;
    out.push({ label, value: Array.isArray(value) ? value.join(', ') : String(value) });
  };
  if (type === 'ROUND') {
    push('Temperature', data.temp ? `${data.temp}° F` : null);
    push('Pain', data.pain);
    push('Appetite', data.appetite);
    push('Hydration', data.hydration);
    push('Wound', data.wound);
    push('Stool / Urine', data.stool);
    push('Progress', data.progress);
    push('Notes', data.notes);
  } else if (type === 'DIAGNOSTIC') {
    push('Tests', data.tests);
    push('Findings', data.findings);
    push('Interpretation', data.interpretation);
  } else if (type === 'SURGERY') {
    push('Surgery', data.surgeryName);
    push('Surgeon', data.surgeon);
    push('Anesthesia', data.anesthesia);
    push('Duration', data.duration);
    push('Findings', data.findings);
    push('Complications', data.complications);
    push('Post-op care', data.postOp);
  } else if (type === 'FOOD') {
    push('Food', data.foodType);
    push('Quantity', data.qty);
    push('Water', data.water);
    push('Intake', data.intake);
    push('Vomiting?', data.vomiting ? 'Yes' : null);
  } else if (type === 'BATH') {
    push('Type', data.bathType);
    push('Grooming by', data.groomingBy);
    push('Remarks', data.remarks);
  } else if (type === 'WALK') {
    push('Duration', data.duration);
    push('Urination', data.urination ? 'Passed' : null);
    push('Stool', data.stool ? 'Passed' : null);
    push('Mobility', data.mobility);
    push('Movement', data.assisted ? 'Assisted' : 'Independent');
  } else if (type === 'ADMISSION') {
    push('Summary', data.summary);
  }
  return out;
}
