'use client';
import { Photo } from '@/components/media/Photo';
import { EmptyState } from '@/components/ui/EmptyState';
import { relativeTime } from '@/lib/time';
import {
  Activity as ActivityIcon,
  Bath,
  Footprints,
  type LucideIcon,
  Microscope,
  Pill as PillIcon,
  Salad,
  Scissors,
  Stethoscope,
  UserPlus,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ACTIVITY_LABELS, type ActivityType } from '../schema';
import { ActivitySheet, type ActivitySummary } from './ActivitySheet';

export interface SerializedActivity {
  id: string;
  animalId: string;
  type: ActivityType;
  occurredAt: string;
  byName: string;
  remarks: string | null;
  editedAt: string | null;
  // biome-ignore lint/suspicious/noExplicitAny: server-erased data shape
  data: any;
  media: { id: string; assetId: string; kind: 'PHOTO' | 'VIDEO' | 'XRAY' | 'DOC'; label: string | null }[];
}

interface Props {
  activities: SerializedActivity[];
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

export function ActivityTimeline({ activities }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<ActivitySummary | null>(null);

  if (activities.length === 0) {
    return (
      <EmptyState
        icon={ActivityIcon}
        title="No activities yet"
        description="Log treatments, rounds, food, walks, and other care actions to populate this feed."
      />
    );
  }

  const groups = groupByDay(activities);

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
      <div className="flex flex-col gap-5">
        {groups.map(([day, items]) => (
          <div key={day}>
            <div className="mb-2 flex items-baseline gap-2 px-1">
              <h3 className="font-display text-[13px] font-bold">{formatDayHeader(day)}</h3>
              <span className="text-[11px] text-muted">{items.length} entries</span>
            </div>
            <ol className="flex flex-col gap-2">
              {items.map((a) => (
                <ActivityRow key={a.id} activity={a} onClick={() => onClickRow(a)} />
              ))}
            </ol>
          </div>
        ))}
      </div>
      <ActivitySheet
        activity={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
        onChanged={() => router.refresh()}
      />
    </>
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
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-start gap-3 rounded-xl border border-line bg-paper p-3 text-left transition hover:border-accent/40 hover:bg-paper-2"
      >
        <div className="relative shrink-0">
          {firstPhoto ? (
            <>
              <Photo
                seed={firstPhoto.assetId}
                src={firstPhoto.usePlaceholder ? undefined : `/api/files/${firstPhoto.assetId}`}
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
    </li>
  );
}

function groupByDay(activities: SerializedActivity[]): Array<[string, SerializedActivity[]]> {
  const map = new Map<string, SerializedActivity[]>();
  for (const a of activities) {
    const d = new Date(a.occurredAt);
    d.setHours(0, 0, 0, 0);
    const k = d.toISOString();
    const list = map.get(k) ?? [];
    list.push(a);
    map.set(k, list);
  }
  return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
}

function formatDayHeader(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yest = new Date(today);
  yest.setDate(yest.getDate() - 1);
  if (d.getTime() === today.getTime()) return 'Today';
  if (d.getTime() === yest.getTime()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short' });
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
