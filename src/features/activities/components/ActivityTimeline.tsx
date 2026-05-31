'use client';
import { Photo } from '@/components/media/Photo';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  type LifecycleDocLite,
  LifecycleRecordSheet,
} from '@/features/animals/lifecycle/components/LifecycleRecordSheet';
import type { LifecycleEvent } from '@/features/animals/lifecycle/events';
import { type ActivityFeedEvent, useActivityFeed } from '@/lib/hooks/useActivityFeed';
import { relativeTime } from '@/lib/time';
import {
  Activity as ActivityIcon,
  ArrowRight,
  Bath,
  Footprints,
  type LucideIcon,
  Microscope,
  Pill as PillIcon,
  Salad,
  Scissors,
  Skull,
  Stethoscope,
  UserPlus,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { type ActivityFilter, filterActivities, rangeLabel, toDateInputValue } from '../filter';
import { ACTIVITY_LABELS, type ActivityType } from '../schema';
import type { SerializedActivity } from '../serialized';
import { ActivityDateFilter } from './ActivityDateFilter';
import { ActivitySheet, type ActivitySummary } from './ActivitySheet';

export type { SerializedActivity } from '../serialized';

interface Props {
  activities: SerializedActivity[];
  animalId: string;
  admittedAt: string;
  caseLocked?: boolean;
  lifecycleEvents?: LifecycleEvent[];
  lifecycleDocs?: { death: LifecycleDocLite[]; discharge: LifecycleDocLite[] };
  currentUserRole?: string | undefined;
}

interface TypeMeta {
  icon: LucideIcon;
  color: string;
}

const TYPE_META: Record<ActivityType, TypeMeta> = {
  ADMISSION: { icon: UserPlus, color: '#0E7C7B' },
  TREATMENT: { icon: PillIcon, color: '#2563EB' },
  ROUND: { icon: Stethoscope, color: '#7C3AED' },
  DIAGNOSTIC: { icon: Microscope, color: '#0891B2' },
  SURGERY: { icon: Scissors, color: '#B5471A' },
  FOOD: { icon: Salad, color: '#15803D' },
  BATH: { icon: Bath, color: '#0EA5E9' },
  WALK: { icon: Footprints, color: '#A16207' },
};

type TimelineItem =
  | { kind: 'activity'; at: string; activity: SerializedActivity; key: string }
  | { kind: 'lifecycle'; at: string; event: LifecycleEvent; key: string };

type FlatRow = { kind: 'header'; day: string; count: number; key: string } | TimelineItem;

const LIFECYCLE_META = {
  admission: { icon: UserPlus, color: '#0E7C7B', label: 'Admitted' },
  discharge: { icon: ArrowRight, color: '#15803D', label: 'Discharged' },
  death: { icon: Skull, color: '#5B6B7A', label: 'Deceased' },
} as const;

function flattenItemsByDay(activities: SerializedActivity[], lifecycleEvents: LifecycleEvent[]): FlatRow[] {
  // Merge activities + synthetic lifecycle events into one time-sorted stream
  // (newest first), then bucket by calendar day with header rows. Activities
  // keep their existing key (`a.id`); lifecycle keys are derived from kind+time.
  const items: TimelineItem[] = [
    ...activities.map((a): TimelineItem => ({ kind: 'activity', at: a.occurredAt, activity: a, key: a.id })),
    ...lifecycleEvents.map(
      (e): TimelineItem => ({ kind: 'lifecycle', at: e.at, event: e, key: `lc-${e.kind}-${e.at}` }),
    ),
  ];
  items.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));

  const groups = new Map<string, TimelineItem[]>();
  for (const item of items) {
    const d = new Date(item.at);
    d.setHours(0, 0, 0, 0);
    const k = d.toISOString();
    const list = groups.get(k) ?? [];
    list.push(item);
    groups.set(k, list);
  }

  const out: FlatRow[] = [];
  for (const [day, dayItems] of Array.from(groups.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1))) {
    out.push({ kind: 'header', day, count: dayItems.length, key: `h-${day}` });
    for (const item of dayItems) out.push(item);
  }
  return out;
}

export function ActivityTimeline({
  activities: initial,
  animalId,
  admittedAt,
  caseLocked,
  lifecycleEvents = [],
  lifecycleDocs = { death: [], discharge: [] },
  currentUserRole,
}: Props) {
  const [activities, setActivities] = useState<SerializedActivity[]>(initial);
  useEffect(() => {
    setActivities(initial);
  }, [initial]);

  const { lastEvent } = useActivityFeed();
  // Seed with the event present at mount so a subscriber that mounts (or
  // remounts after a tab switch) AFTER an event was dispatched doesn't replay
  // that stale event — only events fired while mounted are applied.
  const lastSeenEventRef = useRef<ActivityFeedEvent | null>(lastEvent);

  useEffect(() => {
    if (!lastEvent || lastEvent === lastSeenEventRef.current) return;
    lastSeenEventRef.current = lastEvent;
    if (lastEvent.kind === 'created') {
      if (lastEvent.activity.animalId === animalId) {
        setActivities((prev) =>
          prev.some((a) => a.id === lastEvent.activity.id) ? prev : [lastEvent.activity, ...prev],
        );
      }
    } else if (lastEvent.kind === 'removed') {
      setActivities((prev) => prev.filter((a) => a.id !== lastEvent.id));
    }
  }, [lastEvent, animalId]);

  const onSaved = (next: SerializedActivity) => {
    setActivities((prev) => prev.map((a) => (a.id === next.id ? next : a)));
  };
  const onDeleted = (id: string) => {
    setActivities((prev) => prev.filter((a) => a.id !== id));
  };
  const onDuplicated = (next: SerializedActivity) => {
    setActivities((prev) => [next, ...prev]);
  };
  const onRestored = (next: SerializedActivity) => {
    setActivities((prev) =>
      [next, ...prev].sort((a, b) =>
        a.occurredAt < b.occurredAt ? 1 : a.occurredAt > b.occurredAt ? -1 : 0,
      ),
    );
  };
  const [selected, setSelected] = useState<ActivitySummary | null>(null);
  const [recordEvent, setRecordEvent] = useState<LifecycleEvent | null>(null);
  const [filter, setFilter] = useState<ActivityFilter>({ kind: 'all' });

  const visible = useMemo(() => filterActivities(activities, filter, new Date()), [activities, filter]);
  const rows = flattenItemsByDay(visible, lifecycleEvents);

  // Lower bound for the custom range = the oldest thing in the feed (admission,
  // or an even-older back-dated activity). Never block a day that has an entry.
  const minDate = toDateInputValue(
    new Date(activities.reduce((m, a) => Math.min(m, Date.parse(a.occurredAt)), Date.parse(admittedAt))),
  );
  const maxDate = toDateInputValue(new Date());

  if (activities.length === 0 && lifecycleEvents.length === 0) {
    return (
      <EmptyState
        icon={ActivityIcon}
        title="No activities yet"
        description="Log treatments, rounds, food, walks, and other care actions to populate this feed."
      />
    );
  }

  const onClickRow = (a: SerializedActivity) => {
    setSelected({
      id: a.id,
      animalId: a.animalId,
      type: a.type,
      occurredAt: new Date(a.occurredAt),
      byName: a.byName,
      remarks: a.remarks,
      data: a.data,
      editedAt: a.editedAt ? new Date(a.editedAt) : null,
      media: a.media,
    });
  };

  return (
    <>
      {activities.length > 0 && (
        <TimelineFilterBar
          filter={filter}
          onChange={setFilter}
          minDate={minDate}
          maxDate={maxDate}
          visibleCount={visible.length}
          totalCount={activities.length}
        />
      )}
      <div className="relative">
        {rows.map((row) => {
          if (row.kind === 'header') {
            return (
              <div key={row.key} className="mb-2 flex items-baseline gap-2 px-1 pt-2">
                <h3 className="font-display text-[13px] font-bold">{formatDayHeader(row.day)}</h3>
                <span className="text-[11px] text-muted">{row.count} entries</span>
              </div>
            );
          }
          if (row.kind === 'lifecycle') {
            return (
              <div key={row.key} className="pb-2">
                <LifecycleRow
                  event={row.event}
                  {...(row.event.kind === 'admission' ? {} : { onClick: () => setRecordEvent(row.event) })}
                />
              </div>
            );
          }
          return (
            <div key={row.key} className="pb-2">
              <ActivityRow activity={row.activity} onClick={() => onClickRow(row.activity)} />
            </div>
          );
        })}
      </div>
      <ActivitySheet
        activity={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
        onSaved={onSaved}
        onDeleted={onDeleted}
        onDuplicated={onDuplicated}
        onRestored={onRestored}
        {...(caseLocked !== undefined ? { caseLocked } : {})}
      />
      <LifecycleRecordSheet
        event={recordEvent}
        animalId={animalId}
        {...(currentUserRole !== undefined ? { currentUserRole } : {})}
        docs={
          recordEvent?.kind === 'death'
            ? lifecycleDocs.death
            : recordEvent?.kind === 'discharge'
              ? lifecycleDocs.discharge
              : []
        }
        onClose={() => setRecordEvent(null)}
      />
    </>
  );
}

function TimelineFilterBar({
  filter,
  onChange,
  minDate,
  maxDate,
  visibleCount,
  totalCount,
}: {
  filter: ActivityFilter;
  onChange: (f: ActivityFilter) => void;
  minDate: string;
  maxDate: string;
  visibleCount: number;
  totalCount: number;
}) {
  const label = rangeLabel(filter, new Date());
  return (
    <div className="mb-3 flex flex-col gap-2">
      <ActivityDateFilter value={filter} onChange={onChange} minDate={minDate} maxDate={maxDate} />
      {filter.kind !== 'all' && (
        <p className="px-1 text-[11.5px] text-muted">
          {visibleCount === 0
            ? `No activity ${label}`
            : `Showing ${visibleCount} of ${totalCount} entries · ${label}`}{' '}
          ·{' '}
          <button
            type="button"
            className="font-semibold text-accent"
            onClick={() => onChange({ kind: 'all' })}
          >
            Show all
          </button>
        </p>
      )}
    </div>
  );
}

function ActivityRow({ activity: a, onClick }: { activity: SerializedActivity; onClick: () => void }) {
  const meta = TYPE_META[a.type];
  const Icon = meta.icon;
  // Prefer a real photo for the row thumbnail; if the only attached
  // media is a video / doc, fall back to a generic placeholder driven
  // by `Photo`'s `kind` prop (it renders a play badge for video, a
  // document strip for doc, etc.).  The old `a.media[0]` blindly fed
  // an mp4 URL into an <img>, which 404'd visually with the palette
  // brown background.
  const firstStill = a.media.find((m) => m.kind === 'PHOTO' || m.kind === 'XRAY');
  const firstAny = firstStill ?? a.media[0];
  const firstPhoto = firstAny
    ? {
        ...firstAny,
        usePlaceholder: !firstStill,
      }
    : null;

  return (
    <div>
      <button
        type="button"
        onClick={onClick}
        data-testid="activity-row"
        className="flex w-full items-start gap-3 rounded-xl border border-line bg-paper p-3 text-left transition hover:border-accent/40 hover:bg-paper-2"
      >
        <div className="relative shrink-0">
          {firstPhoto ? (
            <>
              <Photo
                seed={firstPhoto.assetId}
                src={firstPhoto.usePlaceholder ? undefined : firstPhoto.url}
                kind={
                  firstPhoto.kind === 'VIDEO'
                    ? 'video'
                    : firstPhoto.kind === 'XRAY'
                      ? 'xray'
                      : firstPhoto.kind === 'DOC'
                        ? 'doc'
                        : 'photo'
                }
                alt=""
                rounded={11}
                className="h-12 w-12 ring-2"
                sizes="48px"
              />
              <span
                className="-bottom-1 -right-1 absolute flex h-[22px] w-[22px] items-center justify-center rounded-full text-white"
                style={{ backgroundColor: meta.color, boxShadow: '0 0 0 2px white' }}
              >
                <Icon size={12} strokeWidth={2.4} />
              </span>
              {a.media.length > 1 && (
                <span className="-top-1 -left-1 absolute inline-flex h-[18px] min-w-[20px] items-center justify-center rounded-full bg-text px-1 font-bold text-[10px] text-white">
                  +{a.media.length - 1}
                </span>
              )}
            </>
          ) : (
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl"
              style={{ background: `${meta.color}1A`, color: meta.color }}
            >
              <Icon size={20} strokeWidth={2} />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-display text-[14px] font-bold">{ACTIVITY_LABELS[a.type]}</span>
            <span className="text-[11.5px] text-muted">{formatTime(a.occurredAt)}</span>
          </div>
          <ActivityBody type={a.type} data={a.data} />
          {a.remarks && a.type !== 'TREATMENT' && (
            <p className="mt-1.5 text-[12.5px] text-muted">{a.remarks}</p>
          )}
          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-soft">
            <span>by {a.byName}</span>
            {a.editedAt && <span className="italic">· edited {relativeTime(new Date(a.editedAt))}</span>}
          </div>
        </div>
      </button>
    </div>
  );
}

function LifecycleRow({ event, onClick }: { event: LifecycleEvent; onClick?: () => void }) {
  const meta = LIFECYCLE_META[event.kind];
  const Icon = meta.icon;
  const inner = (
    <div
      data-testid="lifecycle-row"
      className="flex w-full items-start gap-3 rounded-xl border border-line bg-paper p-3 text-left"
    >
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
        style={{ background: `${meta.color}1A`, color: meta.color }}
      >
        <Icon size={20} strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span
            className={`font-display text-[14px] font-bold ${event.invalidated ? 'text-soft line-through' : ''}`}
          >
            {meta.label}
          </span>
          <span className="text-[11.5px] text-muted">{formatTime(event.at)}</span>
        </div>
        {event.detail && (
          <p className={`mt-1 text-[13px] ${event.invalidated ? 'text-soft line-through' : 'text-text'}`}>
            {event.detail}
          </p>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-soft">
          {event.byName && <span>by {event.byName}</span>}
          {event.invalidated && (
            <span className="font-semibold text-observation">
              · Invalidated{event.invalidatedByName ? ` by ${event.invalidatedByName}` : ''}
            </span>
          )}
        </div>
      </div>
    </div>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className="w-full transition hover:opacity-90">
      {inner}
    </button>
  ) : (
    <div>{inner}</div>
  );
}

// Fixed weekday/month names so the header is byte-identical on server and
// client. `toLocaleDateString(undefined, …)` skewed across ICU versions
// (server "Fri, 29 May" vs browser "Fri 29 May") → hydration mismatch.
const HEADER_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HEADER_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDayHeader(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yest = new Date(today);
  yest.setDate(yest.getDate() - 1);
  if (d.getTime() === today.getTime()) return 'Today';
  if (d.getTime() === yest.getTime()) return 'Yesterday';
  return `${HEADER_WEEKDAYS[d.getDay()]} ${String(d.getDate()).padStart(2, '0')} ${HEADER_MONTHS[d.getMonth()]}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const HOUR = 60 * 60 * 1000;
  // Recent activities (< 6h) get a relative stamp — doctors scan the
  // timeline much faster when "20m ago" / "3h ago" replaces "10:41 PM".
  // Older same-day activities show clock time; older days show clock
  // time only (the day-grouping header already supplies the date).
  //
  // NOTE: relative-time output is naturally consistent server↔client.
  // The absolute branch goes through `clockTime` (24h, fixed locale)
  // for the same reason — see lib/time.ts.
  if (diff >= 0 && diff < 6 * HOUR) return relativeTime(d);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function ActivityBody({ type, data }: { type: ActivityType; data: Record<string, unknown> | null }) {
  if (!data) return null;
  const summary = summarize(type, data);
  if (!summary) return null;
  return <p className="mt-1 text-[13.5px] text-text">{summary}</p>;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: per-type summary is a flat switch
function summarize(type: ActivityType, data: Record<string, unknown>): string {
  if (type === 'ADMISSION') return String(data.summary ?? 'Admitted');
  if (type === 'TREATMENT') {
    const meds = (data.meds ?? []) as Array<{ name: string; dose: string; route: string }>;
    if (meds.length === 0) return String(data.remarks ?? 'Treatment given');
    return meds.map((m) => `${m.name} ${m.dose} ${m.route}`).join(', ');
  }
  if (type === 'ROUND') {
    const parts: string[] = [];
    if (data.temp) parts.push(`Temp ${data.temp}°`);
    if (data.pain) parts.push(`Pain ${data.pain}`);
    if (data.progress) parts.push(String(data.progress));
    return parts.join(' · ') || String(data.notes ?? 'Round notes');
  }
  if (type === 'DIAGNOSTIC') {
    const tests = ((data.tests ?? []) as string[]).join(', ');
    const tail = data.findings ? ` — ${String(data.findings)}` : '';
    return `${tests}${tail}`;
  }
  if (type === 'SURGERY') {
    return `${String(data.surgeryName ?? '')} (${String(data.duration ?? '—')}) — ${String(data.surgeon ?? '—')}`;
  }
  if (type === 'FOOD') {
    const parts: string[] = [String(data.foodType ?? '—')];
    if (data.qty) parts.push(String(data.qty));
    if (data.intake) parts.push(String(data.intake));
    if (data.vomiting) parts.push('vomited');
    return parts.join(' · ');
  }
  if (type === 'BATH') {
    return `${String(data.bathType ?? '—')}${data.remarks ? ` — ${String(data.remarks)}` : ''}`;
  }
  if (type === 'WALK') {
    const parts: string[] = [];
    if (data.duration) parts.push(String(data.duration));
    if (data.urination) parts.push('urination ✓');
    if (data.stool) parts.push('stool ✓');
    if (data.mobility) parts.push(String(data.mobility));
    return parts.join(' · ');
  }
  return '';
}
