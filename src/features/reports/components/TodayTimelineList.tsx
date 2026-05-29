'use client';
import { Photo } from '@/components/media/Photo';
import { ActivitySheet, type ActivitySummary } from '@/features/activities/components/ActivitySheet';
import { ACTIVITY_LABELS, type ActivityType } from '@/features/activities/schema';
import type { SerializedActivity } from '@/features/activities/serialized';
import { summarizeActivity } from '@/features/activities/summary';
import type { TodayLifecycleEvent } from '@/features/outcomes/queries';
import { type ActivityFeedEvent, useActivityFeed } from '@/lib/hooks/useActivityFeed';
import { relativeTime } from '@/lib/time';
import {
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
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

interface TypeMeta {
  icon: LucideIcon;
  color: string;
  tint: string;
}

const TYPE_META: Record<ActivityType, TypeMeta> = {
  ADMISSION: { icon: UserPlus, color: '#0E7C7B', tint: '#D6EEEE' },
  TREATMENT: { icon: PillIcon, color: '#2563EB', tint: '#DBE7FF' },
  ROUND: { icon: Stethoscope, color: '#7C3AED', tint: '#EADDFF' },
  DIAGNOSTIC: { icon: Microscope, color: '#0891B2', tint: '#CDF0F5' },
  SURGERY: { icon: Scissors, color: '#B5471A', tint: '#F6E2D2' },
  FOOD: { icon: Salad, color: '#15803D', tint: '#DCFAE6' },
  BATH: { icon: Bath, color: '#0EA5E9', tint: '#D8EFFB' },
  WALK: { icon: Footprints, color: '#A16207', tint: '#FCEEC4' },
};

const TODAY_LC_META = {
  admission: { icon: UserPlus, color: '#0E7C7B', label: 'Admitted' },
  discharge: { icon: ArrowRight, color: '#15803D', label: 'Discharged' },
  death: { icon: Skull, color: '#5B6B7A', label: 'Deceased' },
} as const;

export interface TodayTimelineRow {
  id: string;
  animalId: string;
  animalName: string;
  animalSpecies: string;
  /** Pre-signed URL for the animal's intake thumbnail, ready to use in <img src>. */
  animalThumbnailUrl: string | null;
  type: ActivityType;
  occurredAt: string;
  byName: string;
  remarks: string | null;
  // biome-ignore lint/suspicious/noExplicitAny: server-erased data shape
  data: any;
  editedAt: string | null;
  media: Array<{
    id: string;
    assetId: string;
    kind: 'PHOTO' | 'VIDEO' | 'XRAY' | 'DOC';
    label: string | null;
    /** Pre-signed URL for this media asset, ready to use in <img src>. */
    url: string;
  }>;
  summary: string;
}

interface Props {
  items: TodayTimelineRow[];
  lifecycleEvents?: TodayLifecycleEvent[];
}

/**
 * Convert a SerializedActivity (returned by server actions) to the
 * TodayTimelineRow shape used by this component.
 *
 * `prev` threads through existing animal-level fields (name, species,
 * thumbnail) when updating a row in place — those fields come from
 * the server-join and aren't present in SerializedActivity.  For new
 * rows appended from QuickAdd, `prev` is undefined and those fields
 * are blank; they'll be populated correctly on the next navigation.
 */
function activityToFeedItem(a: SerializedActivity, prev?: TodayTimelineRow): TodayTimelineRow {
  return {
    id: a.id,
    animalId: a.animalId,
    animalName: prev?.animalName ?? '',
    animalSpecies: prev?.animalSpecies ?? '',
    animalThumbnailUrl: prev?.animalThumbnailUrl ?? null,
    type: a.type,
    occurredAt: a.occurredAt,
    byName: a.byName,
    remarks: a.remarks,
    data: a.data,
    editedAt: a.editedAt,
    media: a.media,
    summary: summarizeActivity({ type: a.type, data: a.data, remarks: a.remarks }),
  };
}

function TodayTimelineRowItem({
  item,
  isFirst,
  onClick,
}: {
  item: TodayTimelineRow;
  isFirst: boolean;
  onClick: () => void;
}) {
  const meta = TYPE_META[item.type];
  const Icon = meta.icon;
  // Thumbnail strategy:
  //  1. Prefer the activity's own first PHOTO/XRAY — render the real
  //     asset (wound, x-ray, treatment scene).
  //  2. Else if the activity has VIDEO/DOC media — render Photo's
  //     procedural placeholder with the right `kind` so the play /
  //     doc badge shows (no broken <img>).
  //  3. Else (no activity media) — show the animal's intake photo
  //     so doctors still recognise the patient.
  //  4. Else fall back to the procedural avatar.
  const firstStill = item.media.find((m) => m.kind === 'PHOTO' || m.kind === 'XRAY');
  const firstNonStill = item.media.find((m) => m.kind === 'VIDEO' || m.kind === 'DOC');
  let thumbSrc: string | undefined;
  let thumbKind: 'photo' | 'video' | 'xray' | 'doc' = 'photo';
  if (firstStill) {
    thumbSrc = firstStill.url;
    thumbKind = firstStill.kind === 'XRAY' ? 'xray' : 'photo';
  } else if (firstNonStill) {
    thumbSrc = undefined;
    thumbKind = firstNonStill.kind === 'VIDEO' ? 'video' : 'doc';
  } else if (item.animalThumbnailUrl) {
    thumbSrc = item.animalThumbnailUrl;
    thumbKind = 'photo';
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start gap-3 py-3 text-left transition hover:bg-paper-2 ${
        isFirst ? '' : 'border-line border-t'
      }`}
    >
      <div className="relative shrink-0">
        <Photo
          seed={item.id}
          src={thumbSrc}
          kind={thumbKind}
          rounded={12}
          className="h-14 w-14"
          alt=""
          sizes="56px"
        />
        {/* Type badge in the corner — mirrors the per-patient
            ActivityTimeline so the visual grammar is shared. */}
        <span
          className="-bottom-1 -right-1 absolute flex h-[22px] w-[22px] items-center justify-center rounded-full text-white"
          style={{ backgroundColor: meta.color, boxShadow: '0 0 0 2px white' }}
        >
          <Icon size={12} strokeWidth={2.4} />
        </span>
        {item.media.length > 1 && (
          <span className="-top-1 -left-1 absolute inline-flex h-[18px] min-w-[20px] items-center justify-center rounded-full bg-text px-1 font-bold text-[10px] text-white">
            +{item.media.length - 1}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="font-display font-semibold text-[14px]">{item.animalName}</span>
          <span className="text-[11.5px] text-soft">{item.animalSpecies}</span>
          <span
            className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-semibold text-[10.5px]"
            style={{ backgroundColor: meta.tint, color: meta.color }}
          >
            {ACTIVITY_LABELS[item.type]}
          </span>
        </div>
        {item.summary && item.summary !== '—' && (
          <p className="mt-0.5 line-clamp-2 text-[12.5px] text-muted">{item.summary}</p>
        )}
        <p className="mt-0.5 text-[11px] text-soft">
          {relativeTime(new Date(item.occurredAt))} · by {item.byName}
        </p>
      </div>
    </button>
  );
}

export function TodayTimelineList({ items: initial, lifecycleEvents = [] }: Props) {
  const [items, setItems] = useState(initial);
  const [selected, setSelected] = useState<ActivitySummary | null>(null);

  useEffect(() => {
    setItems(initial);
  }, [initial]);

  const { lastEvent } = useActivityFeed();
  // Seed with the event present at mount so this cross-animal feed doesn't
  // replay a stale event on mount (it has no animalId filter, so the id-dedupe
  // below is its only other guard).
  const lastSeenEventRef = useRef<ActivityFeedEvent | null>(lastEvent);

  useEffect(() => {
    if (!lastEvent || lastEvent === lastSeenEventRef.current) return;
    lastSeenEventRef.current = lastEvent;
    if (lastEvent.kind === 'created') {
      const created = lastEvent.activity;
      // Match the server's today window ([start of local day, now]); a
      // back-dated or future-dated QuickAdd doesn't belong in "today" and would
      // disappear on the next revalidate, so don't inject it here either.
      const occurred = new Date(created.occurredAt).getTime();
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      if (occurred < startOfToday.getTime() || occurred > Date.now()) return;
      setItems((prev) =>
        prev.some((it) => it.id === created.id)
          ? prev
          : [
              activityToFeedItem(
                created,
                prev.find((it) => it.animalId === created.animalId),
              ),
              ...prev,
            ],
      );
    } else if (lastEvent.kind === 'removed') {
      setItems((prev) => prev.filter((it) => it.id !== lastEvent.id));
    }
  }, [lastEvent]);

  const openSheet = (it: TodayTimelineRow) => {
    setSelected({
      id: it.id,
      animalId: it.animalId,
      type: it.type,
      occurredAt: new Date(it.occurredAt),
      byName: it.byName,
      remarks: it.remarks,
      data: it.data,
      editedAt: it.editedAt ? new Date(it.editedAt) : null,
      media: it.media,
    });
  };

  // Build a merged, time-sorted (descending) display list of activities and lifecycle events.
  type DisplayEntry =
    | { kind: 'activity'; at: string; item: TodayTimelineRow }
    | { kind: 'lifecycle'; at: string; event: TodayLifecycleEvent };

  const merged: DisplayEntry[] = [
    ...items.map((item): DisplayEntry => ({ kind: 'activity', at: item.occurredAt, item })),
    ...lifecycleEvents.map((event): DisplayEntry => ({ kind: 'lifecycle', at: event.at, event })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <>
      <div className="relative">
        {merged.map((entry, index) => {
          if (entry.kind === 'activity') {
            return (
              <TodayTimelineRowItem
                key={entry.item.id}
                item={entry.item}
                isFirst={index === 0}
                onClick={() => openSheet(entry.item)}
              />
            );
          }
          const e = entry.event;
          const meta = TODAY_LC_META[e.kind];
          const Icon = meta.icon;
          return (
            <Link
              key={`lc-${e.kind}-${e.animalId}`}
              href={`/patients/${e.animalId}`}
              className={`flex w-full items-start gap-3 py-3 text-left transition hover:bg-paper-2 ${
                index === 0 ? '' : 'border-line border-t'
              }`}
            >
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl"
                style={{ background: `${meta.color}1A`, color: meta.color }}
              >
                <Icon size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-display font-semibold text-[14px]">{e.animalName}</span>
                  <span
                    className="inline-flex items-center rounded-full px-1.5 py-0.5 font-semibold text-[10.5px]"
                    style={{ backgroundColor: `${meta.color}1A`, color: meta.color }}
                  >
                    {meta.label}
                  </span>
                </div>
                {e.detail && <p className="mt-0.5 line-clamp-2 text-[12.5px] text-muted">{e.detail}</p>}
              </div>
            </Link>
          );
        })}
      </div>
      <ActivitySheet
        activity={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
        onSaved={(next) => {
          setItems((prev) => prev.map((it) => (it.id === next.id ? activityToFeedItem(next, it) : it)));
        }}
        onDeleted={(id) => {
          setItems((prev) => prev.filter((it) => it.id !== id));
        }}
        onDuplicated={(next) => {
          // The duplicate is for the same animal as the source row — carry its
          // name / species / thumbnail so the new row isn't blank-identity.
          setItems((prev) => [
            activityToFeedItem(
              next,
              prev.find((it) => it.animalId === next.animalId),
            ),
            ...prev,
          ]);
        }}
        onRestored={(next) => {
          setItems((prev) => [
            activityToFeedItem(
              next,
              prev.find((it) => it.animalId === next.animalId),
            ),
            ...prev,
          ]);
        }}
      />
    </>
  );
}
