'use client';
import { Photo } from '@/components/media/Photo';
import { ActivitySheet, type ActivitySummary } from '@/features/activities/components/ActivitySheet';
import { ACTIVITY_LABELS, type ActivityType } from '@/features/activities/schema';
import { relativeTime } from '@/lib/time';
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
import { useRouter } from 'next/navigation';
import { useState } from 'react';

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

export function TodayTimelineList({ items }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<ActivitySummary | null>(null);

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

  return (
    <>
      <ul className="flex flex-col">
        {items.map((it, idx) => {
          const meta = TYPE_META[it.type];
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
          const firstStill = it.media.find((m) => m.kind === 'PHOTO' || m.kind === 'XRAY');
          const firstNonStill = it.media.find((m) => m.kind === 'VIDEO' || m.kind === 'DOC');
          let thumbSrc: string | undefined;
          let thumbKind: 'photo' | 'video' | 'xray' | 'doc' = 'photo';
          if (firstStill) {
            thumbSrc = firstStill.url;
            thumbKind = firstStill.kind === 'XRAY' ? 'xray' : 'photo';
          } else if (firstNonStill) {
            thumbSrc = undefined;
            thumbKind = firstNonStill.kind === 'VIDEO' ? 'video' : 'doc';
          } else if (it.animalThumbnailUrl) {
            thumbSrc = it.animalThumbnailUrl;
            thumbKind = 'photo';
          }
          return (
            <li key={it.id}>
              <button
                type="button"
                onClick={() => openSheet(it)}
                className={`flex w-full items-start gap-3 py-3 text-left transition hover:bg-paper-2 ${
                  idx > 0 ? 'border-line border-t' : ''
                }`}
              >
                <div className="relative shrink-0">
                  <Photo
                    seed={it.id}
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
                  {it.media.length > 1 && (
                    <span className="-top-1 -left-1 absolute inline-flex h-[18px] min-w-[20px] items-center justify-center rounded-full bg-text px-1 font-bold text-[10px] text-white">
                      +{it.media.length - 1}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="font-display font-semibold text-[14px]">{it.animalName}</span>
                    <span className="text-[11.5px] text-soft">{it.animalSpecies}</span>
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-semibold text-[10.5px]"
                      style={{ backgroundColor: meta.tint, color: meta.color }}
                    >
                      {ACTIVITY_LABELS[it.type]}
                    </span>
                  </div>
                  {it.summary && it.summary !== '—' && (
                    <p className="mt-0.5 line-clamp-2 text-[12.5px] text-muted">{it.summary}</p>
                  )}
                  <p className="mt-0.5 text-[11px] text-soft">
                    {relativeTime(new Date(it.occurredAt))} · by {it.byName}
                  </p>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      <ActivitySheet
        activity={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
        onSaved={() => router.refresh()}
        onDeleted={() => router.refresh()}
        onDuplicated={() => router.refresh()}
        onRestored={() => router.refresh()}
      />
    </>
  );
}
