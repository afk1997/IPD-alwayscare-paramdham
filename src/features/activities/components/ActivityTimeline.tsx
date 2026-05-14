import { EmptyState } from '@/components/ui/EmptyState';
import { relativeTime } from '@/lib/time';
import type { Activity, ActivityMedia, MediaAsset } from '@prisma/client';
import {
  Activity as ActivityIcon,
  Bath,
  Footprints,
  Microscope,
  Pill,
  Salad,
  Scissors,
  Stethoscope,
  UserPlus,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Image from 'next/image';
import { ACTIVITY_LABELS, type ActivityType } from '../schema';

type WithMedia = Activity & {
  media: (ActivityMedia & { asset: MediaAsset })[];
  byUser: { id: string; name: string } | null;
};

const ICON: Record<string, LucideIcon> = {
  ADMISSION: UserPlus,
  TREATMENT: Pill,
  ROUND: Stethoscope,
  DIAGNOSTIC: Microscope,
  SURGERY: Scissors,
  FOOD: Salad,
  BATH: Bath,
  WALK: Footprints,
};

interface Props {
  activities: WithMedia[];
}

export function ActivityTimeline({ activities }: Props) {
  if (activities.length === 0) {
    return (
      <EmptyState
        icon={ActivityIcon}
        title="No activities yet"
        description="Log treatments, rounds, food, walks, and other care actions to populate this feed."
      />
    );
  }

  return (
    <ol className="flex flex-col gap-3">
      {activities.map((a) => {
        const Icon = ICON[a.type] ?? ActivityIcon;
        return (
          <li key={a.id} className="flex gap-3">
            <div className="flex shrink-0 flex-col items-center">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent-ink">
                <Icon size={15} />
              </div>
              <div className="my-1 w-px flex-1 bg-line" />
            </div>
            <div className="flex-1 rounded-lg border border-line bg-paper p-4">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-display text-sm font-semibold">
                  {ACTIVITY_LABELS[a.type as ActivityType]}
                </span>
                <span className="text-xs text-muted">· {relativeTime(a.occurredAt)}</span>
                <span className="text-xs text-muted">· by {a.byName}</span>
                {a.editedAt && <span className="text-[10px] uppercase text-soft">edited</span>}
              </div>
              <ActivityBody activity={a} />
              {a.remarks && <p className="mt-2 text-sm text-muted">{a.remarks}</p>}
              {a.media.length > 0 && (
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {a.media.map((m) => (
                    <div
                      key={m.id}
                      className="relative aspect-square overflow-hidden rounded-md border border-line"
                    >
                      <Image
                        src={`/api/files/${m.asset.id}`}
                        alt={m.label ?? m.asset.filename}
                        fill
                        sizes="120px"
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

type D = Record<string, unknown>;

const BODY_RENDERERS: Record<string, (data: D) => React.ReactNode> = {
  TREATMENT: renderTreatment,
  ROUND: renderRound,
  DIAGNOSTIC: renderDiagnostic,
  SURGERY: renderSurgery,
  FOOD: renderFood,
  BATH: renderBath,
  WALK: renderWalk,
  ADMISSION: renderAdmission,
};

function ActivityBody({ activity }: { activity: WithMedia }) {
  const data = activity.data as D | null;
  if (!data) return null;
  const renderer = BODY_RENDERERS[activity.type];
  return renderer ? renderer(data) : null;
}

function renderTreatment(data: D) {
  const meds = data.meds as Array<{ name: string; dose: string; route: string }> | undefined;
  if (!meds) return null;
  return (
    <ul className="mt-2 flex flex-col gap-1 text-sm">
      {meds.map((m) => (
        <li key={`${m.name}-${m.dose}-${m.route}`} className="font-mono text-xs text-text">
          {m.name} · {m.dose} · {m.route}
        </li>
      ))}
    </ul>
  );
}

function renderRound(data: D) {
  return (
    <KeyValueGrid
      data={data}
      keys={['temp', 'appetite', 'hydration', 'pain', 'wound', 'stool', 'progress', 'notes']}
    />
  );
}

function renderDiagnostic(data: D) {
  const tests = (data.tests as string[]) ?? [];
  return (
    <div className="mt-2 text-sm">
      <div className="flex flex-wrap gap-1.5">
        {tests.map((t) => (
          <span key={t} className="rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent-ink">
            {t}
          </span>
        ))}
      </div>
      {Boolean(data.findings) && <p className="mt-2">{String(data.findings)}</p>}
      {Boolean(data.interpretation) && <p className="mt-1 text-muted">→ {String(data.interpretation)}</p>}
    </div>
  );
}

function renderSurgery(data: D) {
  return (
    <div className="mt-2 text-sm">
      <div className="font-medium">{String(data.surgeryName ?? '')}</div>
      <div className="text-xs text-muted">
        by {String(data.surgeon ?? '—')} {data.anesthesia ? `· ${data.anesthesia}` : ''}{' '}
        {data.duration ? `· ${data.duration}` : ''}
      </div>
      {Boolean(data.findings) && <p className="mt-1">{String(data.findings)}</p>}
      {Boolean(data.complications) && <p className="mt-1 text-critical">⚠ {String(data.complications)}</p>}
      {Boolean(data.postOp) && <p className="mt-1 text-muted">Post-op: {String(data.postOp)}</p>}
    </div>
  );
}

function renderFood(data: D) {
  return (
    <div className="mt-2 text-sm">
      <span className="font-medium">{String(data.foodType ?? '—')}</span>
      {Boolean(data.qty) && <span className="text-muted"> · {String(data.qty)}</span>}
      {Boolean(data.water) && <span className="text-muted"> · water {String(data.water)}</span>}
      <span className="ml-2 rounded bg-paper-2 px-1.5 py-0.5 text-xs">{String(data.intake)}</span>
      {Boolean(data.vomiting) && (
        <span className="ml-1 rounded bg-critical-bg px-1.5 py-0.5 text-xs text-critical">Vomited</span>
      )}
    </div>
  );
}

function renderBath(data: D) {
  return (
    <div className="mt-2 text-sm">
      <span className="font-medium">{String(data.bathType ?? '—')}</span>
      {Boolean(data.groomingBy) && <span className="text-muted"> · by {String(data.groomingBy)}</span>}
      {Boolean(data.remarks) && <p className="mt-1 text-muted">{String(data.remarks)}</p>}
    </div>
  );
}

function renderWalk(data: D) {
  return (
    <div className="mt-2 text-sm">
      {Boolean(data.duration) && <span>{String(data.duration)}</span>}
      {Boolean(data.mobility) && <span className="text-muted"> · {String(data.mobility)}</span>}
      <span className="ml-2 text-xs text-muted">
        {data.urination ? '✓ urinated ' : ''}
        {data.stool ? '✓ stool ' : ''}
        {data.assisted ? '· assisted' : ''}
      </span>
    </div>
  );
}

function renderAdmission(data: D) {
  return <p className="mt-2 text-sm">{String(data.summary ?? '')}</p>;
}

function KeyValueGrid({ data, keys }: { data: Record<string, unknown>; keys: string[] }) {
  const items = keys.filter((k) => Boolean(data[k]));
  if (items.length === 0) return null;
  return (
    <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
      {items.map((k) => (
        <div key={k}>
          <span className="text-xs text-muted">{labelize(k)}: </span>
          <span>{String(data[k])}</span>
        </div>
      ))}
    </div>
  );
}

function labelize(k: string): string {
  return k.charAt(0).toUpperCase() + k.slice(1);
}
