'use client';
import { Photo } from '@/components/media/Photo';
import { ActivitySheet, type ActivitySummary } from '@/features/activities/components/ActivitySheet';
import { ACTIVITY_LABELS, type ActivityType } from '@/features/activities/schema';
import type { SerializedActivity } from '@/features/activities/serialized';
import { summarizeActivity } from '@/features/activities/summary';
import { type ActivityFeedEvent, useActivityFeed } from '@/lib/hooks/useActivityFeed';
import { relativeTime } from '@/lib/time';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
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

export function TodayTimelineList({ items: initial }: Props) {
  const [items, setItems] = useState(initial);
  const [selected, setSelected] = useState<ActivitySummary | null>(null);

  useEffect(() => {
    setItems(initial);
  }, [initial]);

  const { lastEvent } = useActivityFeed();
  const lastSeenEventRef = useRef<ActivityFeedEvent | null>(null);

  useEffect(() => {
    if (!lastEvent || lastEvent === lastSeenEventRef.current) return;
    lastSeenEventRef.current = lastEvent;
    if (lastEvent.kind === 'created') {
      setItems((prev) =>
        prev.some((it) => it.id === lastEvent.activity.id)
          ? prev
          : [activityToFeedItem(lastEvent.activity), ...prev],
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

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 92,
    overscan: 5,
  });

  return (
    <>
      <div ref={parentRef} className="max-h-[70vh] overflow-y-auto md:max-h-[75vh]">
        <div style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
          {virtualizer.getVirtualItems().map((vi) => {
            const it = items[vi.index];
            if (!it) return null;
            return (
              <div
                key={it.id}
                data-index={vi.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${vi.start}px)`,
                }}
              >
                <div className="pb-2">
                  <TodayTimelineRowItem item={it} isFirst={vi.index === 0} onClick={() => openSheet(it)} />
                </div>
              </div>
            );
          })}
        </div>
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
          setItems((prev) => [activityToFeedItem(next), ...prev]);
        }}
        onRestored={(next) => {
          setItems((prev) => [activityToFeedItem(next), ...prev]);
        }}
      />
    </>
  );
}
