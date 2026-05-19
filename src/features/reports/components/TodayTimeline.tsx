import { Photo } from '@/components/media/Photo';
import { ACTIVITY_LABELS } from '@/features/activities/schema';
import { relativeTime } from '@/lib/time';
import type { ActivityType } from '@prisma/client';
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
import Link from 'next/link';
import { listTodayActivities } from '../queries';

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

export async function TodayTimeline() {
  const items = await listTodayActivities();

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-line border-dashed bg-paper py-10 text-center">
        <ActivityIcon size={22} className="text-soft" />
        <p className="font-medium text-[13px] text-muted">Nothing logged yet today.</p>
        <p className="text-[12px] text-soft">
          Treatments, rounds, food, baths, walks — tap "+ New entry" or press N to log the first one.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col">
      {items.map((it, idx) => {
        const meta = TYPE_META[it.type];
        const Icon = meta.icon;
        const photoSrc = it.animalThumbnailKey
          ? `/api/files/${it.animalThumbnailKey.split(':').pop()}`
          : undefined;
        return (
          <li key={it.id}>
            <Link
              href={`/patients/${it.animalId}`}
              className={`relative flex items-start gap-3 py-3 transition hover:bg-paper-2 ${
                idx > 0 ? 'border-line border-t' : ''
              }`}
            >
              <Photo
                seed={it.animalId}
                src={photoSrc}
                rounded={11}
                className="h-10 w-10 shrink-0"
                alt={it.animalName}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="font-display font-semibold text-[14px]">{it.animalName}</span>
                  <span className="text-[11.5px] text-soft">{it.animalSpecies}</span>
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-semibold text-[10.5px]"
                    style={{ backgroundColor: meta.tint, color: meta.color }}
                  >
                    <Icon size={11} strokeWidth={2.3} />
                    {ACTIVITY_LABELS[it.type]}
                  </span>
                </div>
                {it.summary && it.summary !== '—' && (
                  <p className="mt-0.5 line-clamp-2 text-[12.5px] text-muted">{it.summary}</p>
                )}
                <p className="mt-0.5 text-[11px] text-soft">
                  {relativeTime(it.occurredAt)} · by {it.byName}
                </p>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
