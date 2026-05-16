'use client';
import { EmptyState } from '@/components/ui/EmptyState';
import { relativeTime } from '@/lib/time';
import {
  Activity as ActivityIcon,
  Bath,
  Footprints,
  type LucideIcon,
  Microscope,
  Pill,
  Salad,
  Scissors,
  Stethoscope,
  UserPlus,
} from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ACTIVITY_LABELS, type ActivityType } from '../schema';
import { ActivitySheet, type ActivitySummary } from './ActivitySheet';

interface SerializedActivity {
  id: string;
  animalId: string;
  type: ActivityType;
  occurredAt: string;
  byName: string;
  remarks: string | null;
  editedAt: string | null;
  // biome-ignore lint/suspicious/noExplicitAny: server-erased shape
  data: any;
  media: { id: string; assetId: string; label: string | null }[];
}

interface Props {
  activities: SerializedActivity[];
}

interface TypeMeta {
  icon: LucideIcon;
  color: string;
  tint: string;
}

const TYPE_META: Record<ActivityType, TypeMeta> = {
  ADMISSION: { icon: UserPlus, color: '#0E7C7B', tint: '#D6EEEE' },
  TREATMENT: { icon: Pill, color: '#2563EB', tint: '#DBEAFE' },
  ROUND: { icon: Stethoscope, color: '#7C3AED', tint: '#EDE9FE' },
  DIAGNOSTIC: { icon: Microscope, color: '#0891B2', tint: '#CFFAFE' },
  SURGERY: { icon: Scissors, color: '#B5471A', tint: '#FFE4D2' },
  FOOD: { icon: Salad, color: '#15803D', tint: '#DCFCE7' },
  BATH: { icon: Bath, color: '#0EA5E9', tint: '#E0F2FE' },
  WALK: { icon: Footprints, color: '#A16207', tint: '#FEF3C7' },
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
    });
  };

  return (
    <>
      <ol className="relative flex flex-col gap-3 pl-1">
        {activities.map((a) => {
          const meta = TYPE_META[a.type];
          const Icon = meta.icon;
          const firstPhoto = a.media[0];
          const hasMedia = !!firstPhoto;
          return (
            <li key={a.id} className="flex gap-3">
              <div className="relative flex shrink-0 flex-col items-center pt-2">
                {hasMedia ? (
                  <div className="relative h-11 w-11 shrink-0">
                    <Image
                      src={`/api/files/${firstPhoto.assetId}`}
                      alt=""
                      fill
                      sizes="44px"
                      className="rounded-[11px] object-cover ring-2"
                      style={{ boxShadow: `0 0 0 2px ${meta.color}` }}
                      unoptimized
                    />
                    <span
                      className="-bottom-1 -right-1 absolute flex h-5 w-5 items-center justify-center rounded-full text-white shadow-md"
                      style={{ backgroundColor: meta.color }}
                    >
                      <Icon size={11} strokeWidth={2.4} />
                    </span>
                    {a.media.length > 1 && (
                      <span className="-top-1.5 -left-1.5 absolute flex h-4 min-w-[18px] items-center justify-center rounded-full bg-text px-1 font-bold text-[9px] text-white">
                        +{a.media.length - 1}
                      </span>
                    )}
                  </div>
                ) : (
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-paper"
                    style={{ boxShadow: `inset 0 0 0 2px ${meta.color}`, color: meta.color }}
                  >
                    <Icon size={16} strokeWidth={2} />
                  </div>
                )}
                <div className="mt-1 w-px flex-1 bg-line" />
              </div>

              <button
                type="button"
                onClick={() => onClickRow(a)}
                className="flex-1 rounded-lg border border-line bg-paper p-4 text-left transition hover:border-accent/40 hover:bg-paper-2"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-display text-sm font-bold">{ACTIVITY_LABELS[a.type]}</span>
                  <span className="text-[11.5px] text-muted">
                    {relativeTime(new Date(a.occurredAt))}
                    {' · '}
                    {new Date(a.occurredAt).toLocaleTimeString(undefined, {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                <ActivityBody type={a.type} data={a.data} />

                {a.remarks && a.type !== 'TREATMENT' && (
                  <p className="mt-1.5 text-sm text-muted">{a.remarks}</p>
                )}

                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-soft">
                  <span>by {a.byName}</span>
                  {a.editedAt && <span className="italic">· edited</span>}
                </div>
              </button>
            </li>
          );
        })}
      </ol>

      <ActivitySheet
        activity={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
        onChanged={() => router.refresh()}
      />
    </>
  );
}

function ActivityBody({ type, data }: { type: ActivityType; data: Record<string, unknown> | null }) {
  if (!data) return null;
  const renderer = BODY_RENDERERS[type];
  return renderer ? renderer(data) : null;
}

type D = Record<string, unknown>;

const BODY_RENDERERS: Record<ActivityType, (data: D) => React.ReactNode> = {
  TREATMENT: renderTreatment,
  ROUND: renderRound,
  DIAGNOSTIC: renderDiagnostic,
  SURGERY: renderSurgery,
  FOOD: renderFood,
  BATH: renderBath,
  WALK: renderWalk,
  ADMISSION: renderAdmission,
};

function renderTreatment(data: D) {
  const meds = (data.meds ?? []) as Array<{ name: string; dose: string; route: string }>;
  if (meds.length === 0) return null;
  return <p className="mt-1.5 text-sm">{meds.map((m) => `${m.name} ${m.dose} ${m.route}`).join(', ')}</p>;
}

function renderRound(data: D) {
  const parts: string[] = [];
  if (data.temp) parts.push(`Temp ${data.temp}°`);
  if (data.pain) parts.push(`Pain ${data.pain}`);
  if (data.progress) parts.push(String(data.progress));
  if (parts.length === 0 && data.notes) return <p className="mt-1.5 text-sm">{String(data.notes)}</p>;
  return <p className="mt-1.5 text-sm">{parts.join(' · ')}</p>;
}

function renderDiagnostic(data: D) {
  const tests = (data.tests as string[]) ?? [];
  const tail = data.findings ? ` — ${String(data.findings)}` : '';
  return (
    <p className="mt-1.5 text-sm">
      {tests.join(', ')}
      {tail}
    </p>
  );
}

function renderSurgery(data: D) {
  return (
    <p className="mt-1.5 text-sm">
      {String(data.surgeryName ?? '')}
      {data.duration ? ` (${String(data.duration)})` : ''} — {String(data.surgeon ?? '—')}
    </p>
  );
}

function renderFood(data: D) {
  const parts: string[] = [String(data.foodType ?? '—')];
  if (data.qty) parts.push(String(data.qty));
  if (data.intake) parts.push(String(data.intake));
  if (data.vomiting) parts.push('vomited');
  return <p className="mt-1.5 text-sm">{parts.join(' · ')}</p>;
}

function renderBath(data: D) {
  return (
    <p className="mt-1.5 text-sm">
      {String(data.bathType ?? '—')}
      {data.remarks ? ` — ${String(data.remarks)}` : ''}
    </p>
  );
}

function renderWalk(data: D) {
  const parts: string[] = [];
  if (data.duration) parts.push(String(data.duration));
  if (data.urination) parts.push('urination ✓');
  if (data.stool) parts.push('stool ✓');
  if (data.mobility) parts.push(String(data.mobility));
  return <p className="mt-1.5 text-sm">{parts.join(' · ')}</p>;
}

function renderAdmission(data: D) {
  return <p className="mt-1.5 text-sm">{String(data.summary ?? '')}</p>;
}
