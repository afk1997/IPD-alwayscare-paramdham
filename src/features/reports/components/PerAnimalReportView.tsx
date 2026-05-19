import { Pill } from '@/components/ui/Pill';
import { ACTIVITY_LABELS } from '@/features/activities/schema';
import { formatDateTime } from '@/lib/time';
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
import type { PerAnimalReport } from '../queries';

const TYPE_ICON: Record<ActivityType, LucideIcon> = {
  ADMISSION: UserPlus,
  TREATMENT: PillIcon,
  ROUND: Stethoscope,
  DIAGNOSTIC: Microscope,
  SURGERY: Scissors,
  FOOD: Salad,
  BATH: Bath,
  WALK: Footprints,
};

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

interface Props {
  report: PerAnimalReport;
}

export function PerAnimalReportView({ report }: Props) {
  const { animal, totals, history } = report;
  const status =
    animal.deceasedAt != null ? 'Deceased' : animal.dischargedAt != null ? 'Discharged' : 'Admitted';
  const statusTone: 'critical' | 'stable' | 'observation' | 'neutral' =
    animal.deceasedAt != null ? 'critical' : animal.dischargedAt != null ? 'neutral' : 'stable';
  const total = Object.values(totals).reduce((a, b) => a + b, 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-line bg-paper p-4">
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <span className="font-display font-bold text-[20px]">{animal.name}</span>
            <span className="text-[12.5px] text-muted">
              {animal.species}
              {animal.ward ? ` · ${animal.ward}` : ''}
            </span>
          </div>
          <Pill status={statusTone} className="ml-auto">
            {status}
          </Pill>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-[12.5px]">
          <div className="text-muted">
            Admitted <span className="text-text">{formatDateTime(animal.admittedAt)}</span>
          </div>
          {animal.dischargedAt && (
            <div className="text-muted">
              Discharged <span className="text-text">{formatDateTime(animal.dischargedAt)}</span>
            </div>
          )}
          {animal.deceasedAt && (
            <div className="text-muted">
              Died <span className="text-text">{formatDateTime(animal.deceasedAt)}</span>
            </div>
          )}
        </div>
      </div>

      <div>
        <h2 className="mb-2 font-bold text-[10.5px] text-muted uppercase tracking-[0.07em]">
          Activity totals · {total}
        </h2>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {(Object.entries(totals) as [ActivityType, number][]).map(([type, count]) => {
            const Icon = TYPE_ICON[type];
            const color = TYPE_COLOR[type];
            const dim = count === 0;
            return (
              <div
                key={type}
                className={`flex items-center gap-2.5 rounded-xl border border-line bg-paper px-3 py-2.5 ${dim ? 'opacity-50' : ''}`}
              >
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${color}1f`, color }}
                >
                  <Icon size={15} />
                </div>
                <div className="min-w-0">
                  <div className="font-display font-bold text-[18px] leading-none">{count}</div>
                  <div className="mt-0.5 truncate text-[11.5px] text-muted">{ACTIVITY_LABELS[type]}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-bold text-[10.5px] text-muted uppercase tracking-[0.07em]">
            Complete history · {history.length}
          </h2>
          <Link
            href={`/patients/${animal.id}`}
            className="font-semibold text-[12px] text-accent hover:underline"
          >
            Open patient page ›
          </Link>
        </div>

        {history.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-line border-dashed bg-paper py-8 text-center">
            <ActivityIcon size={20} className="text-soft" />
            <p className="text-[12.5px] text-muted">No activities for this patient yet.</p>
          </div>
        ) : (
          <ul className="flex flex-col rounded-2xl border border-line bg-paper">
            {history.map((h, idx) => {
              const Icon = TYPE_ICON[h.type];
              const color = TYPE_COLOR[h.type];
              return (
                <li
                  key={h.id}
                  className={`flex items-start gap-3 px-3 py-2.5 ${idx > 0 ? 'border-line border-t' : ''}`}
                >
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${color}1f`, color }}
                  >
                    <Icon size={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-semibold text-[13.5px]">{ACTIVITY_LABELS[h.type]}</span>
                      <span className="text-[11.5px] text-soft">
                        {formatDateTime(h.occurredAt)} · by {h.byName}
                      </span>
                    </div>
                    {h.summary && h.summary !== '—' && (
                      <p className="mt-0.5 line-clamp-2 text-[12.5px] text-muted">{h.summary}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
